"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type OptionValue = { id: string; label: string };
type OptionGroup = {
  id: string;
  name: string;
  type: "select" | "radio" | "checkbox" | "text";
  required: boolean;
  allowEmpty?: boolean; // важно: “может быть пустая”
  values?: OptionValue[];
};

type Variant = {
  id: string;
  selections: Record<string, string | string[]>;
  sku?: string;
  pricing: { mode: "final" | "delta"; value: number };
  oldPrice: number | null;
  stock: number;
  isActive: boolean;
};

type Product = {
  id: string;
  title: string;
  brand: string;
  condition: "new" | "used";
  optionGroups: OptionGroup[];
  variants: Variant[];
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-6)}`;
}

export default function ProductOptionsEditor({ params }: any) {
  const productId = params?.id as string;

  const [initData, setInitData] = useState("");
  const [role, setRole] = useState<"loading" | "admin" | "user">("loading");

  const [product, setProduct] = useState<Product | null>(null);
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

  async function load() {
    setMsg("");
    const r = await fetch("/api/admin/products", { headers: { "X-TG-INIT-DATA": initData } });
    const j = await r.json();
    if (!j.ok) return setMsg(`Ошибка: ${j.error}`);
    const p = (j.products || []).find((x: any) => x.id === productId) || null;
    setProduct(p);
  }

  useEffect(() => {
    if (role === "admin") load();
  }, [role]); // eslint-disable-line

  async function save(next: Product) {
    setMsg("");
    const r = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-TG-INIT-DATA": initData },
      body: JSON.stringify({
        id: next.id,
        patch: {
          title: next.title,
          brand: next.brand,
          condition: next.condition,
          optionGroups: next.optionGroups,
          variants: next.variants,
        },
      }),
    });
    const j = await r.json();
    if (!j.ok) return setMsg(`Ошибка: ${j.error}`);
    setProduct(j.product);
    setMsg("Сохранено ✅");
  }

  const groups = product?.optionGroups || [];
  const variants = product?.variants || [];

  const groupValueLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      for (const v of g.values || []) m.set(v.id, v.label);
    }
    return m;
  }, [groups]);

  function selectionToText(v: Variant) {
    const parts: string[] = [];
    for (const g of groups) {
      if (g.type === "text") continue;
      const sel = v.selections?.[g.id];
      if (Array.isArray(sel)) {
        const lbl = sel.map((id) => groupValueLabel.get(id) || id).join(", ");
        parts.push(`${g.name}: ${lbl || "—"}`);
      } else {
        const lbl = sel ? groupValueLabel.get(sel) || sel : "—";
        parts.push(`${g.name}: ${lbl}`);
      }
    }
    return parts.join(" • ");
  }

  function canAutoGenerate() {
    return groups.filter((g) => g.type !== "text").every((g) => g.type === "select" || g.type === "radio");
  }

  function generateVariants() {
    if (!product) return;
    if (!canAutoGenerate()) {
      setMsg("Автогенерация работает только для select/radio. Для checkbox — делаем вручную.");
      return;
    }

    const g2 = groups.filter((g) => g.type !== "text");
    const axes = g2.map((g) => {
      const vals = (g.values || []).map((x) => x.id);
      if (g.allowEmpty) vals.unshift(""); // пустое значение допустимо
      return { groupId: g.id, vals, required: g.required, allowEmpty: !!g.allowEmpty };
    });

    function cartesian(i: number, cur: Record<string, string>, out: Record<string, string>[]) {
      if (i >= axes.length) {
        out.push({ ...cur });
        return;
      }
      const ax = axes[i];
      for (const val of ax.vals) {
        cur[ax.groupId] = val;
        cartesian(i + 1, cur, out);
      }
    }

    const combos: Record<string, string>[] = [];
    cartesian(0, {}, combos);

    // фильтруем комбинации: обязательные группы не могут быть пустыми
    const filtered = combos.filter((sel) => {
      for (const ax of axes) {
        if (ax.required && (!sel[ax.groupId] || sel[ax.groupId] === "")) return false;
      }
      return true;
    });

    const keyOf = (sel: Record<string, string>) => axes.map((a) => `${a.groupId}:${sel[a.groupId] || ""}`).join("|");
    const oldMap = new Map<string, Variant>();
    for (const v of variants) {
      const sel: Record<string, string> = {};
      for (const ax of axes) {
        const vv = v.selections?.[ax.groupId];
        sel[ax.groupId] = typeof vv === "string" ? vv : "";
      }
      oldMap.set(keyOf(sel), v);
    }

    const nextVariants: Variant[] = filtered.map((sel) => {
      const key = keyOf(sel);
      const old = oldMap.get(key);

      return (
        old || {
          id: uid(`v_${product.id}`),
          selections: { ...sel },
          pricing: { mode: "final", value: 0 },
          oldPrice: null,
          stock: 0,
          isActive: true,
        }
      );
    });

    const next: Product = { ...product, variants: nextVariants };
    setProduct(next);
    setMsg("Варианты сгенерированы. Нажми «Сохранить» ✅");
  }

  function addGroup() {
    if (!product) return;
    const g: OptionGroup = {
      id: uid("g"),
      name: "",
      type: "select",
      required: true,
      allowEmpty: false,
      values: [],
    };
    const next: Product = { ...product, optionGroups: [...groups, g] };
    setProduct(next);
  }

  function moveGroup(idx: number, dir: -1 | 1) {
    if (!product) return;
    const next = [...groups];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const t = next[idx];
    next[idx] = next[j];
    next[j] = t;
    setProduct({ ...product, optionGroups: next });
  }

  function deleteGroup(id: string) {
    if (!product) return;
    const ok = confirm("Удалить группу опций? Это может сломать варианты. Лучше потом пересоздать варианты.");
    if (!ok) return;

    const nextGroups = groups.filter((g) => g.id !== id);
    // также чистим selections у вариантов
    const nextVariants = variants.map((v) => {
      const s = { ...(v.selections || {}) };
      delete s[id];
      return { ...v, selections: s };
    });

    setProduct({ ...product, optionGroups: nextGroups, variants: nextVariants });
  }

  function addValue(groupId: string) {
    if (!product) return;
    const nextGroups = groups.map((g) => {
      if (g.id !== groupId) return g;
      const values = [...(g.values || []), { id: uid(`val_${groupId}`), label: "" }];
      return { ...g, values };
    });
    setProduct({ ...product, optionGroups: nextGroups });
  }

  function updateGroup(groupId: string, patch: Partial<OptionGroup>) {
    if (!product) return;
    const nextGroups = groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
    setProduct({ ...product, optionGroups: nextGroups });
  }

  function updateValue(groupId: string, valueId: string, label: string) {
    if (!product) return;
    const nextGroups = groups.map((g) => {
      if (g.id !== groupId) return g;
      const values = (g.values || []).map((v) => (v.id === valueId ? { ...v, label } : v));
      return { ...g, values };
    });
    setProduct({ ...product, optionGroups: nextGroups });
  }

  function deleteValue(groupId: string, valueId: string) {
    if (!product) return;
    const nextGroups = groups.map((g) => {
      if (g.id !== groupId) return g;
      const values = (g.values || []).filter((v) => v.id !== valueId);
      return { ...g, values };
    });

    // чистим variants: если значение удалили — делаем selection пустым
    const nextVariants = variants.map((v) => {
      const sel = { ...(v.selections || {}) };
      const cur = sel[groupId];
      if (Array.isArray(cur)) {
        sel[groupId] = cur.filter((x) => x !== valueId);
      } else if (cur === valueId) {
        sel[groupId] = "";
      }
      return { ...v, selections: sel };
    });

    setProduct({ ...product, optionGroups: nextGroups, variants: nextVariants });
  }

  function patchVariant(variantId: string, patch: Partial<Variant>) {
    if (!product) return;
    const nextVariants = variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v));
    setProduct({ ...product, variants: nextVariants });
  }

  if (role === "loading") return <main style={{ padding: 16, fontFamily: "system-ui" }}>Загрузка…</main>;
  if (role !== "admin")
    return (
      <main style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1>⚙️ Опции/варианты</h1>
        <p>Нет доступа.</p>
        <Link href="/admin" style={{ textDecoration: "none" }}>
          ← Назад
        </Link>
      </main>
    );

  if (!product)
    return (
      <main style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1>⚙️ Опции/варианты</h1>
        <p>Товар не найден.</p>
        <Link href="/admin/products" style={{ textDecoration: "none" }}>
          ← К товарам
        </Link>
      </main>
    );

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>⚙️ Опции/варианты</h1>
        <Link href="/admin/products" style={{ textDecoration: "none" }}>
          ← К товарам
        </Link>
        <button onClick={() => save(product)} style={{ padding: "10px 12px" }}>
          💾 Сохранить
        </button>
        <button onClick={load}>Обновить</button>
      </div>

      <div style={{ marginTop: 8, opacity: 0.85 }}>
        <b>{product.title}</b> • {product.brand} • {product.condition === "new" ? "Новый" : "Б/у"}
      </div>

      {msg ? <div style={{ marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 10 }}>{msg}</div> : null}

      <section style={{ marginTop: 14, padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Группы опций</h2>
          <button onClick={addGroup}>➕ Добавить группу опций</button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {groups.map((g, idx) => (
            <div key={g.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <b>Группа {idx + 1}</b>
                  <button onClick={() => moveGroup(idx, -1)} disabled={idx === 0}>
                    ↑
                  </button>
                  <button onClick={() => moveGroup(idx, 1)} disabled={idx === groups.length - 1}>
                    ↓
                  </button>
                  <button onClick={() => deleteGroup(g.id)}>🗑 Удалить группу</button>
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>id: {g.id}</div>
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <input
                  placeholder='Название (например "Память")'
                  value={g.name}
                  onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <label>
                    Тип{" "}
                    <select value={g.type} onChange={(e) => updateGroup(g.id, { type: e.target.value as any })}>
                      <option value="select">select</option>
                      <option value="radio">radio</option>
                      <option value="checkbox">checkbox</option>
                      <option value="text">text</option>
                    </select>
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={!!g.required}
                      onChange={(e) => updateGroup(g.id, { required: e.target.checked })}
                    />{" "}
                    Обязательная
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={!!g.allowEmpty}
                      onChange={(e) => updateGroup(g.id, { allowEmpty: e.target.checked })}
                    />{" "}
                    Может быть пустая
                  </label>
                </div>

                {g.type !== "text" ? (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <b>Значения</b>
                      <button onClick={() => addValue(g.id)}>➕ Добавить значение</button>
                    </div>

                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {(g.values || []).map((v) => (
                        <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            placeholder="Например: 128 / 256 / Черный"
                            value={v.label}
                            onChange={(e) => updateValue(g.id, v.id, e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button onClick={() => deleteValue(g.id, v.id)}>🗑</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ opacity: 0.75, marginTop: 6 }}>
                    Тип <b>text</b> — не участвует в вариантах (это просто поле).
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 14, padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Варианты (комбинации)</h2>
          <button onClick={generateVariants}>⚡ Сгенерировать варианты</button>
        </div>

        <div style={{ marginTop: 8, opacity: 0.75 }}>
          Тут задаём цену/остаток/sku на уровне конкретной комбинации.
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {variants.map((v) => (
            <div key={v.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800 }}>{selectionToText(v) || "Базовый вариант"}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={v.isActive}
                      onChange={(e) => patchVariant(v.id, { isActive: e.target.checked })}
                    />
                    Активен
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <label>
                  Режим цены{" "}
                  <select
                    value={v.pricing?.mode || "final"}
                    onChange={(e) => patchVariant(v.id, { pricing: { ...v.pricing, mode: e.target.value as any } })}
                  >
                    <option value="final">конечная</option>
                    <option value="delta">дельта</option>
                  </select>
                </label>

                <label>
                  Значение{" "}
                  <input
                    type="number"
                    value={v.pricing?.value ?? 0}
                    onChange={(e) => patchVariant(v.id, { pricing: { ...v.pricing, value: Number(e.target.value) } })}
                  />
                </label>

                <label>
                  Старая цена{" "}
                  <input
                    type="number"
                    value={v.oldPrice ?? 0}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patchVariant(v.id, { oldPrice: n > 0 ? n : null });
                    }}
                  />
                </label>

                <label>
                  Остаток{" "}
                  <input type="number" value={v.stock ?? 0} onChange={(e) => patchVariant(v.id, { stock: Number(e.target.value) })} />
                </label>

                <label>
                  SKU{" "}
                  <input value={v.sku ?? ""} onChange={(e) => patchVariant(v.id, { sku: e.target.value || undefined })} />
                </label>
              </div>

              <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>variantId: {v.id}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
