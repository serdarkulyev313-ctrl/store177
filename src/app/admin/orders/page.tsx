"use client";

import { useEffect, useState } from "react";

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

type Order = {
  id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  method: "courier" | "pickup";
  address: string | null;
  comment: string | null;
  items: { title: string; qty: number; price: number }[];
  total: number;
  orderStatus: "created" | "confirmed" | "cancelled" | "completed";
  paymentStatus: "unpaid" | "paid_cash";
};

const ORDER_RU: Record<Order["orderStatus"], string> = {
  created: "Создан",
  confirmed: "Подтверждён",
  cancelled: "Отменён",
  completed: "Завершён",
};

const PAY_RU: Record<Order["paymentStatus"], string> = {
  unpaid: "Не оплачен",
  paid_cash: "Оплачен наличными",
};

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

export default function AdminOrdersPage() {
  const [initData, setInitData] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
    setInitData(getInitData());
  }, []);

  async function load() {
    setMsg("");
    const r = await fetch("/api/admin/orders", {
      headers: initData ? { "X-TG-INIT-DATA": initData } : {},
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (!j?.ok) return setMsg(`Ошибка: ${j?.error || "unknown"}`);
    setOrders(j.orders || []);
  }

  useEffect(() => {
    if (initData) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  async function setStatus(id: string, patch: Partial<Order>) {
    setMsg("");
    const r = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-TG-INIT-DATA": initData },
      body: JSON.stringify({ id, ...patch }),
    });
    const j = await r.json().catch(() => null);
    if (!j?.ok) return setMsg(`Ошибка: ${j?.error || "unknown"}`);
    await load();
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>📦 Заказы</h1>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href="/admin"
          style={{
            display: "inline-block",
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 12,
            textDecoration: "none",
          }}
        >
          ← Назад в админку
        </a>

        <button onClick={load} style={{ padding: "10px 12px", borderRadius: 12 }}>
          🔄 Обновить
        </button>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, border: "1px solid #ddd", borderRadius: 10 }}>{msg}</div>
      ) : null}

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {orders.map((o) => (
          <div key={o.id} style={{ padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
            <div style={{ fontWeight: 700 }}>
              Заказ {o.id} • {ORDER_RU[o.orderStatus]} • {PAY_RU[o.paymentStatus]}
            </div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Клиент: {o.customerName} • {o.phone}
              <br />
              Получение: {o.method === "courier" ? "Курьер" : "Самовывоз"}
              {o.method === "courier" && o.address ? ` • ${o.address}` : ""}
              {o.comment ? <><br />Комментарий: {o.comment}</> : null}
            </div>

            <div style={{ marginTop: 8 }}>
              <b>Состав:</b>
              <ul style={{ marginTop: 6 }}>
                {o.items?.map((it, idx) => (
                  <li key={idx}>
                    {it.title} × {it.qty} = <b>{money(it.price * it.qty)}</b>
                  </li>
                ))}
              </ul>
              <div>Итого: <b>{money(o.total)}</b></div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setStatus(o.id, { orderStatus: "confirmed" })}>✅ Подтвердить</button>
              <button onClick={() => setStatus(o.id, { orderStatus: "completed" })}>📦 Завершить</button>
              <button onClick={() => setStatus(o.id, { orderStatus: "cancelled" })}>❌ Отменить</button>
              <button onClick={() => setStatus(o.id, { paymentStatus: "paid_cash" })}>💵 Оплачен наличными</button>
            </div>
          </div>
        ))}

        {!orders.length ? <div style={{ opacity: 0.7 }}>Заказов пока нет.</div> : null}
      </div>
    </main>
  );
}
