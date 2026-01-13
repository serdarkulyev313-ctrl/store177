"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Product = {
  id: string;
  title: string;
  brand: string;
  condition: "new" | "used";
  price: number;
  oldPrice: number | null;
  stock: number;
};

type OptionGroup = {
  id: string;
  name: string;
  type: "select" | "radio";
  required: boolean;
  values: string[];
};

type ProductVariant = {
  id: string;
  options: Record<string, string | null>;
  priceMode: "delta" | "fixed";
  priceValue: number;
  stock: number;
  sku?: string;
};

type ProductOptions = {
  productId: string;
  groups: OptionGroup[];
  variants: ProductVariant[];
};

function parseHashParams() {
  const raw = (window.location.hash || "").replace(/^#/, "");
  return new URLSearchParams(raw);
}

function getInitData(): string {
  const tgInit = (window as any).Telegram?.WebApp?.initData;
  if (typeof tgInit === "string" && tgInit.length > 0) return tgInit;

  const hp = parseHashParams();
  const fromHash = hp.get("tgWebAppData");
  if (fromHash && fromHash.length > 0) return fromHash;

  return "";
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function normalizeValues(text: string) {
  const raw = text
    .split(/\r?\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function signature(groups: OptionGroup[], options: Record<string, string | null>) {
  const obj: Record<string, any> = {};
  for (const g of groups) obj[g.id] = options[g.id] ?? null;
  return JSON.stringify(obj);
}

export default function ProductOptionsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productIdRaw = (params as any)?.id;
  const productId = typeof productIdRaw === "string" ? productIdRaw : "";

  const [initData, setInitData] = useState("");
  const [role, setRole] = useState<"loading" | "admin" | "user">("loading");

  const [products, setProducts] = useState<Product[]>([]);
  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  const [opts, setOpts] = useState<ProductOptions | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    const id = getInitData();
    setInitData(id);

    (async () => {
      const r = await fetch("/api/admin/me", { headers: id ? { "X-TG-INIT-DATA": id } : {} });
      const j = await r.json();
      setRole(j?.role === "admin" ? "admin" : "user");
    })();
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    if (!productId) return;

    (async () => {
      setMsg("");

      // товары
      const pr = await fetch("/api/admin/products", { headers: { "X-TG-INIT-DATA": initData } });
      const pj = await pr.json();
      if (pj.ok) setProducts(pj.products || []);

      // опции
      const or = await fetch(`/api/admin/product-options?productId=${encodeURIComponent(productId)}`, {
        headers: { "X-TG-INIT-DATA": initData },
        cache: "no-store",
      });
      const oj = await or.json();
      if (!oj.ok) return setMsg(`Ошибка: ${oj.error}`);

      // подстрахуемся, что productId всегда проставлен
      const incoming = (oj.options || {}) as ProductOptions;
      setOpts({
        productId,
        groups: incoming.groups || [],
        variants: incoming.variants || [],
      });
    })();
  }, [role, initData, productId]);

  function ensureOpts(): ProductOptions {
    return opts || { productId: productId || "", groups: [], variants: [] };
  }

  function updateGroups(next: OptionGroup[]) {
    const cur = ensureOpts();
    setOpts({ ...cur, productId: productId || cur.productId, groups: next });
  }

  function updateVariants(next: ProductVariant[]) {
    const cur = ensureOpts();
    setOpts({ ...cur, productId: productId || cur.productId, variants: next });
  }

  function addGroup() {
    const cur = ensureOpts();
    const g: OptionGroup = {
      id: uid("g"),
      name: "Новая группа",
      type: "select",
      required: true,
      values: ["Значение 1"],
    };
    updateGroups([...(cur.groups || []), g]);
  }

  function moveGroup(index: number, dir: -1 | 1) {
    const cur = ensureOpts();
    const arr = [...cur.groups];
    const ni = index + dir;
    if (ni < 0 || ni >= arr.length) return;
    const tmp = arr[index];
    arr[index] = arr[ni];
    arr[ni] = tmp;
    updateGroups(arr);
  }

  function deleteGroup(id: string) {
    const cur = ensureOpts();
    if (!confirm("Удалить группу опций?")) return;
    const groups = cur.groups.filter((g) => g.id !== id);

    // также чистим варианты
    const variants = cur.variants.map((v) => {
      const o = { ...v.options };
      delete o[id];
      return { ...v, options: o };
    });

    setOpts({ ...cur, productId: productId || cur.productId, groups, variants });
  }

  function generateVariants() {
    const cur = ensureOpts();
    const groups = cur.groups;

    // варианты из старых (чтобы сохранять цены/остатки)
    const oldMap = new Map<string, ProductVariant>();
    for (const v of cur.variants) oldMap.set(signature(groups, v.options), v);

    // готовим списки значений (для необязательных добавляем null)
    const lists = groups.map((g) => {
      const vals = (g.values || []).filter(Boolean);
      const uniq = normalizeValues(vals.join("\n"));
      return g.required ? uniq : [null as any, ...uniq];
    });

    // декартово произведение
    const out: ProductVariant[] = [];
    function rec(i: number, acc: Record<string, any>) {
      if (i === groups.length) {
        const sig = signature(groups, acc);
        const old = oldMap.get(sig);
        out.push(
          old || {
            id: uid("v"),
            options: { ...acc },
            priceMode: "delta",
            priceValue: 0,
            stock: 0,
          }
        );
        return;
      }
      const g = groups[i];
      for (const val of lists[i]) {
        rec(i + 1, { ...acc, [g.id]: val ?? null });
      }
    }
    rec(0, {});

    updateVariants(out);
    setMsg(`Сгенерировано вариантов: ${out.length}`);
  }

  async function saveAll() {
    setMsg("");

    if (!productId) {
      setMsg("Ошибка сохранения:\nproductId отсутствует (похоже, страница открыта без корректного /admin/products/[id]).");
      return;
    }

    const cur = ensureOpts();

    // ВАЖНО: бэку отдаем productId в корне, а options — отдельно
    const payload = {
      productId,
      options: {
        groups: cur.groups || [],
        variants: cur.variants || [],
      },
    };

    const r = await fetch("/api/admin/product-options", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-TG-INIT-DATA": initData },
      body: JSON.stringify(payload),
    });

    const j = await r.json();
    if (!j.ok) return setMsg(`Ошибка сохранения:\n${j.error}`);
    setMsg("Сохранено ✅");

    const refresh = await fetch(`/api/admin/product-options?productId=${encodeURIComponent(productId)}`, {
      headers: { "X-TG-INIT-DATA": initData },
      cache: "no-store",
    });
    const refreshed = await refresh.json().catch(() => null);
    if (refreshed?.ok) setOpts(refreshed.options);
  }

  if (role === "loading") return <main style={{ padding: 16, fontFamily: "system-ui" }}>Загрузка…</main>;

  if (role !== "admin") {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1>Опции и варианты</h1>
        <p>Нет доступа.</p>
        <button onClick={() => router.push("/admin/products")} style={{ padding: "10px 12px", borderRadius: 12 }}>
          ← Назад
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <button onClick={() => router.push("/admin/products")} style={{ padding: "10px 12px", borderRadius: 12 }}>
        ← Назад к товарам
      </button>

      <h1 style={{ margin: "12px 0 6px" }}>🧩 Опции и варианты</h1>
      <div style={{ opacity: 0.8 }}>
        Товар: <b>{product?.title || productId}</b>
      </div>

      {msg ? (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 12 }}>
          {msg}
        </pre>
      ) : null}

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={addGroup} style={{ padding: "10px 12px", borderRadius: 12 }}>
          ➕ Добавить группу опций
        </button>
        <button onClick={generateVariants} style={{ padding: "10px 12px", borderRadius: 12 }}>
          ⚙️ Сгенерировать варианты
        </button>
        <button onClick={saveAll} style={{ padding: "10px 12px", borderRadius: 12 }}>
          💾 Сохранить
        </button>
      </div>

      {/* Группы */}
      <section style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Группы опций (лестница)</h2>

        {(opts?.groups || []).length === 0 ? <div style={{ opacity: 0.7 }}>Пока нет групп. Нажми “Добавить группу опций”.</div> : null}

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {(opts?.groups || []).map((g, idx) => (
            <div key={g.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <b>Уровень {idx + 1}</b>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => moveGroup(idx, -1)}>↑</button>
                  <button onClick={() => moveGroup(idx, 1)}>↓</button>
                  <button onClick={() => deleteGroup(g.id)}>🗑 Удалить</button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <label>
                  Название
                  <input
                    value={g.name}
                    onChange={(e) => {
                      const next = ensureOpts().groups.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x));
                      updateGroups(next);
                    }}
                    style={{ width: "100%" }}
                  />
                </label>

                <label>
                  Тип
                  <select
                    value={g.type}
                    onChange={(e) => {
                      const next = ensureOpts().groups.map((x) => (x.id === g.id ? { ...x, type: e.target.value as any } : x));
                      updateGroups(next);
                    }}
                  >
                    <option value="select">Выпадающий список</option>
                    <option value="radio">Радио-кнопки</option>
                  </select>
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={g.required}
                    onChange={(e) => {
                      const next = ensureOpts().groups.map((x) => (x.id === g.id ? { ...x, required: e.target.checked } : x));
                      updateGroups(next);
                    }}
                  />
                  Обязательная группа (если выключить — можно оставить пусто)
                </label>

                <label>
                  Значения (можно через запятую или с новой строки)
                  <textarea
                    rows={4}
                    defaultValue={(g.values || []).join("\n")}
                    onBlur={(e) => {
                      const values = normalizeValues((e.target as any).value || "");
                      const next = ensureOpts().groups.map((x) => (x.id === g.id ? { ...x, values } : x));
                      updateGroups(next);
                    }}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>id: {g.id}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Варианты */}
      <section style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Варианты (комбинации)</h2>

        {(opts?.variants || []).length === 0 ? (
          <div style={{ opacity: 0.7 }}>Пока нет вариантов. Нажми “Сгенерировать варианты”.</div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {(opts?.variants || []).map((v, i) => (
              <div key={v.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
                <div style={{ fontWeight: 700 }}>Вариант #{i + 1}</div>

                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  {(opts?.groups || []).map((g) => (
                    <div key={g.id}>
                      {g.name}: <b>{v.options[g.id] ?? "—"}</b>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <label>
                    Остаток
                    <input
                      type="number"
                      defaultValue={v.stock}
                      onBlur={(e) => {
                        const stock = Number((e.target as any).value);
                        const next = ensureOpts().variants.map((x) => (x.id === v.id ? { ...x, stock } : x));
                        updateVariants(next);
                      }}
                    />
                  </label>

                  <label>
                    Цена
                    <select
                      value={v.priceMode}
                      onChange={(e) => {
                        const priceMode = e.target.value as any;
                        const next = ensureOpts().variants.map((x) => (x.id === v.id ? { ...x, priceMode } : x));
                        updateVariants(next);
                      }}
                    >
                      <option value="delta">Δ к базовой (₽)</option>
                      <option value="fixed">Фикс (₽)</option>
                    </select>
                  </label>

                  <label>
                    Значение
                    <input
                      type="number"
                      defaultValue={v.priceValue}
                      onBlur={(e) => {
                        const priceValue = Number((e.target as any).value);
                        const next = ensureOpts().variants.map((x) => (x.id === v.id ? { ...x, priceValue } : x));
                        updateVariants(next);
                      }}
                    />
                  </label>

                  <label>
                    SKU (опц.)
                    <input
                      defaultValue={v.sku || ""}
                      onBlur={(e) => {
                        const sku = String((e.target as any).value || "").trim() || undefined;
                        const next = ensureOpts().variants.map((x) => (x.id === v.id ? { ...x, sku } : x));
                        updateVariants(next);
                      }}
                    />
                  </label>
                </div>

                <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>id: {v.id}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ height: 40 }} />
    </main>
  );
}
