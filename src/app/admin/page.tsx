"use client";

import Link from "next/link";

export default function AdminHome() {
  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>🔧 Админка Store 177</h1>
      <p style={{ opacity: 0.8, marginTop: 6 }}>Управление товарами и заказами.</p>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link
          href="/admin/products"
          style={{
            display: "inline-block",
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 12,
            textDecoration: "none",
          }}
        >
          🧾 Товары
        </Link>

        <Link
          href="/admin/orders"
          style={{
            display: "inline-block",
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 12,
            textDecoration: "none",
          }}
        >
          📦 Заказы
        </Link>
      </div>
    </main>
  );
}
