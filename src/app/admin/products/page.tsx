"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

type Product = {
  id: string;
  title: string;
  brand: string;
  condition: "new" | "used";
  price?: number;
  stock?: number;
};

export default function AdminProductsPage() {
  const [initData, setInitData] = useState("");
  const [role, setRole] = useState<"loading" | "admin" | "user">("loading");
  const [products, setProducts] = useState<Product[]>([]);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState<"new" | "used">("new");

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    const id = getInitData();
    setInitData(id);

    (async () => {
      const r = await fetch("/api/admin/me", {
        headers: id ? { "X-TG-INIT-DATA": id } : {},
      });
      const j = await r.json();
      setRole(j?.role === "admin" ? "admin" : "user");
    })();
  }, []);

  async function loadProducts() {
    setMsg("");
    const r = await fetch("/api/admin/products", {
      headers: { "X-TG-INIT-DATA": initData },
    });
    const j = await r.json();
    if (!j.ok) return setMsg(`Ошибка: ${j.error}`);
    setProducts(j.products || []);
  }

  useEffect(() => {
    if (role === "admin") loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  async function addProduct() {
    setMsg("");
    const r = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-TG-INIT-DATA": initData },
      body: JSON.stringify({ title, brand, condition, price: 0, stock: 0 }),
    });
    const j = await r.json();
    if (!j.ok) return setMsg(`Ошибка: ${j.error}`);

    setTitle("");
    setBrand("");
    setCondition("new");
    await loadProducts();
    setMsg("Товар добавлен ✅");
  }

  async function deleteProduct(id: string, title: string) {
    const ok = confirm(`Удалить товар:\n\n${title}\n\nТочно?`);
    if (!ok) return;

    setMsg("");
    const r = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "X-TG-INIT-DATA": initData },
      body: JSON.stringify({ id }),
    });
    const j = await r.json();
    if (!j.ok) return setMsg(`Ошибка: ${j.error}`);

    await loadProducts();
    setMsg("Удалено ✅");
  }

  if (role === "loading") return <main style={{ padding: 16, fontFamily: "system-ui" }}>Загрузка…</main>;

  if (role !== "admin") {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1>Товары</h1>
        <p>Нет доступа.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <h1 style={{ margin: 0 }}>📄 Товары</h1>
        <Link href="/admin" style={{ textDecoration: "none" }}>
          ← В админку
        </Link>
      </div>

      <div style={{ marginTop: 8 }}>
        <button onClick={loadProducts}>Обновить</button>
      </div>

      {msg ? (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 10, whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      ) : null}

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Добавить товар</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <input placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Бренд" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <select value={condition} onChange={(e) => setCondition(e.target.value as any)}>
            <option value="new">Новый</option>
            <option value="used">Б/у</option>
          </select>
          <button onClick={addProduct} disabled={!title || !brand}>
            Добавить
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>Список</h2>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {products.map((p) => (
            <div key={p.id} style={{ padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>
                  {p.title} • {p.brand} • {p.condition === "new" ? "Новый" : "Б/у"}
                </div>

                <button
                  onClick={() => deleteProduct(p.id, `${p.title} • ${p.brand}`)}
                  style={{ padding: "6px 10px", borderRadius: 10 }}
                >
                  🗑 Удалить
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link
                  href={`/admin/products/${p.id}`}
                  style={{
                    display: "inline-block",
                    padding: "10px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    textDecoration: "none",
                  }}
                >
                  ⚙ Опции/варианты
                </Link>
              </div>

              <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>id: {p.id}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
