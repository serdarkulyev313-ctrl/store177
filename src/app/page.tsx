"use client";

import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

function parseHashParams() {
  const raw = (window.location.hash || "").replace(/^#/, "");
  return new URLSearchParams(raw);
}

function getInitData(): string {
  const tgInit = window.Telegram?.WebApp?.initData;
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
  price: number;
  oldPrice: number | null;
  images: string[];
  specs: string[];
  stock: number;
};

type CartItem = { productId: string; qty: number };

export default function Home() {
  const [initData, setInitData] = useState("");
  const [server, setServer] = useState("(ещё не проверяли)");
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);

  const [view, setView] = useState<"catalog" | "product" | "cart" | "checkout">("catalog");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderMsg, setOrderMsg] = useState("");

  // checkout form
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"pickup" | "courier">("pickup");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    setInitData(getInitData());

    // cart from localStorage
    try {
      const raw = localStorage.getItem("store177_cart");
      if (raw) setCart(JSON.parse(raw));
    } catch {}

    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(data))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("store177_cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  async function checkServer() {
    const res = await fetch("/api/ping", {
      headers: initData ? { "X-TG-INIT-DATA": initData } : {},
    });
    setServer(await res.text());
  }

  const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const cartCount = cart.reduce((s, x) => s + x.qty, 0);

  const cartLines = cart
    .map((ci) => {
      const p = productById.get(ci.productId);
      if (!p) return null;
      const qty = Math.min(ci.qty, p.stock);
      return { p, qty, sum: qty * p.price };
    })
    .filter(Boolean) as { p: Product; qty: number; sum: number }[];

  const cartTotal = cartLines.reduce((s, x) => s + x.sum, 0);

  function addToCart(productId: string, qtyToAdd = 1) {
    const p = productById.get(productId);
    if (!p) return;

    setCart((prev) => {
      const existing = prev.find((x) => x.productId === productId);
      const currentQty = existing?.qty ?? 0;
      const nextQty = Math.min(currentQty + qtyToAdd, p.stock);

      if (existing) {
        return prev.map((x) => (x.productId === productId ? { ...x, qty: nextQty } : x));
      }
      return [...prev, { productId, qty: Math.max(1, Math.min(qtyToAdd, p.stock)) }];
    });
  }

  function setQty(productId: string, qty: number) {
    const p = productById.get(productId);
    if (!p) return;
    const q = Math.max(0, Math.min(qty, p.stock));

    setCart((prev) => {
      if (q === 0) return prev.filter((x) => x.productId !== productId);
      return prev.map((x) => (x.productId === productId ? { ...x, qty: q } : x));
    });
  }

  function clearCart() {
    setCart([]);
  }

  async function submitOrder() {
    setOrderMsg("");

    if (!cartLines.length) {
      setOrderMsg("Корзина пуста.");
      return;
    }

    const payload = {
      customerName,
      phone,
      method,
      address: method === "courier" ? address : "",
      comment,
      items: cartLines.map((x) => ({ productId: x.p.id, qty: x.qty })),
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(initData ? { "X-TG-INIT-DATA": initData } : {}),
      },
      body: JSON.stringify(payload),
    });

    const j = await res.json().catch(() => ({}));
    if (!j.ok) {
      setOrderMsg(j.error || "Ошибка оформления заказа");
      return;
    }

    clearCart();
    setView("catalog");
    setSelected(null);
    setCustomerName("");
    setPhone("");
    setMethod("pickup");
    setAddress("");
    setComment("");

    setOrderMsg(`Заявка создана ✅ Номер: ${j.orderId}. Менеджер подтвердит.`);
    // Если Telegram WebApp — можно показать нативный popup
    window.Telegram?.WebApp?.showPopup?.({
      title: "Store 177",
      message: `Заявка создана ✅\nНомер: ${j.orderId}\nМенеджер подтвердит.`,
      buttons: [{ type: "ok" }],
    });
  }

  // --- UI ---
  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Store 177</h1>

        <button
          onClick={() => {
            setView("cart");
            setSelected(null);
          }}
          style={{ padding: "10px 12px", borderRadius: 12 }}
        >
          🧺 Корзина ({cartCount})
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <button onClick={checkServer} style={{ padding: "10px 12px", borderRadius: 12 }}>
          Проверить сервер
        </button>
        <div style={{ whiteSpace: "pre-wrap" }}>
          <b>initData:</b> {initData ? "есть ✅" : "нет"}
          {"\n"}
          <b>server:</b> {server}
        </div>
      </div>

      {orderMsg ? (
        <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 12, marginBottom: 12 }}>
          {orderMsg}
        </div>
      ) : null}

      {/* CART VIEW */}
      {view === "cart" ? (
        <>
          <h2 style={{ fontSize: 18, margin: "16px 0 8px" }}>Корзина</h2>

          {!cartLines.length ? (
            <>
              <div style={{ opacity: 0.75 }}>Пусто.</div>
              <button
                style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12 }}
                onClick={() => setView("catalog")}
              >
                ← В каталог
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: 10 }}>
                {cartLines.map((x) => (
                  <div key={x.p.id} style={{ padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
                    <div style={{ fontWeight: 700 }}>
                      {x.p.title} • {x.p.brand}
                    </div>
                    <div style={{ marginTop: 6, opacity: 0.8 }}>
                      Цена: <b>{money(x.p.price)}</b> • В наличии: {x.p.stock}
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                      <button onClick={() => setQty(x.p.id, x.qty - 1)} style={{ padding: "6px 10px", borderRadius: 10 }}>
                        −
                      </button>

                      <input
                        type="number"
                        value={x.qty}
                        min={1}
                        max={x.p.stock}
                        onChange={(e) => setQty(x.p.id, Number(e.target.value))}
                        style={{ width: 80, padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                      />

                      <button onClick={() => setQty(x.p.id, x.qty + 1)} style={{ padding: "6px 10px", borderRadius: 10 }}>
                        +
                      </button>

                      <button
                        onClick={() => setQty(x.p.id, 0)}
                        style={{ padding: "6px 10px", borderRadius: 10 }}
                      >
                        Удалить
                      </button>

                      <div style={{ marginLeft: "auto", fontWeight: 700 }}>Сумма: {money(x.sum)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 16 }}>
                    Итого: <b>{money(cartTotal)}</b>
                  </div>
                  <button
                    onClick={() => setView("checkout")}
                    style={{ padding: "10px 12px", borderRadius: 12 }}
                  >
                    Оформить →
                  </button>
                </div>
              </div>

              <button
                style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12 }}
                onClick={() => setView("catalog")}
              >
                ← В каталог
              </button>
            </>
          )}
        </>
      ) : null}

      {/* CHECKOUT VIEW */}
      {view === "checkout" ? (
        <>
          <h2 style={{ fontSize: 18, margin: "16px 0 8px" }}>Оформление</h2>

          <div style={{ display: "grid", gap: 10, padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
            <input
              placeholder="Имя"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
            <input
              placeholder="Телефон"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />

            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            >
              <option value="pickup">Самовывоз</option>
              <option value="courier">Курьер</option>
            </select>

            {method === "courier" ? (
              <input
                placeholder="Адрес доставки (Москва)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
              />
            ) : (
              <div style={{ opacity: 0.75 }}>
                Самовывоз: адрес магазина добавим отдельным полем позже.
              </div>
            )}

            <textarea
              placeholder="Комментарий (необязательно)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", minHeight: 80 }}
            />

            <div style={{ opacity: 0.8 }}>
              Оплата: <b>наличными при получении</b>.
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <button onClick={() => setView("cart")} style={{ padding: "10px 12px", borderRadius: 12 }}>
                ← В корзину
              </button>

              <button
                onClick={submitOrder}
                style={{ padding: "10px 12px", borderRadius: 12 }}
                disabled={!customerName.trim() || !phone.trim() || (method === "courier" && !address.trim())}
              >
                Отправить заявку
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* CATALOG / PRODUCT (старое поведение) */}
      {view === "catalog" || view === "product" ? (
        !selected ? (
          <>
            <h2 style={{ fontSize: 18, margin: "16px 0 8px" }}>Каталог</h2>

            <div style={{ display: "grid", gap: 10 }}>
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelected(p);
                    setView("product");
                  }}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    border: "1px solid #e5e5e5",
                    borderRadius: 12,
                    background: "white",
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {p.title} • {p.brand}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <b>{money(p.price)}</b>{" "}
                    {p.oldPrice ? (
                      <span style={{ textDecoration: "line-through", opacity: 0.6 }}>
                        {money(p.oldPrice)}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.75 }}>
                    {p.condition === "new" ? "Новый" : "Б/у"} • В наличии: {p.stock}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setSelected(null);
                setView("catalog");
              }}
              style={{ padding: "10px 12px", borderRadius: 12 }}
            >
              ← Назад
            </button>

            <h2 style={{ fontSize: 20, margin: "12px 0 6px" }}>
              {selected.title} • {selected.brand}
            </h2>

            <div style={{ marginBottom: 8 }}>
              <b>{money(selected.price)}</b>{" "}
              {selected.oldPrice ? (
                <span style={{ textDecoration: "line-through", opacity: 0.6 }}>
                  {money(selected.oldPrice)}
                </span>
              ) : null}
            </div>

            <div style={{ opacity: 0.8, marginBottom: 10 }}>
              {selected.condition === "new" ? "Новый" : "Б/у"} • В наличии: {selected.stock}
            </div>

            {selected.images?.[0] ? (
              <img
                src={selected.images[0]}
                alt={selected.title}
                style={{
                  width: "100%",
                  maxWidth: 420,
                  borderRadius: 12,
                  border: "1px solid #e5e5e5",
                }}
              />
            ) : null}

            <h3 style={{ fontSize: 16, marginTop: 12 }}>Характеристики</h3>
            <ul>
              {selected.specs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>

            <button
              disabled={selected.stock <= 0}
              style={{ padding: "12px 14px", borderRadius: 12, marginTop: 10 }}
              onClick={() => {
                addToCart(selected.id, 1);
                setView("cart");
                setSelected(null);
              }}
            >
              {selected.stock > 0 ? "В корзину" : "Нет в наличии"}
            </button>
          </>
        )
      ) : null}
    </main>
  );
}
