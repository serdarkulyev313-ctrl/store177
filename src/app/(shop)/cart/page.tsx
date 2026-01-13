"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import type { CatalogProduct } from "@/lib/storefront";

import { AppHeader } from "../_components/AppHeader";
import { PageContainer } from "../_components/PageContainer";
import { SectionTitle } from "../_components/SectionTitle";
import { useProducts } from "../_hooks/useProducts";
import { useTelegram } from "../_hooks/useTelegram";
import { useCart } from "../_state/cart";

export default function CartPage() {
  const { productMap, loading } = useProducts();
  const { initData } = useTelegram();
  const { items, setQty, removeItem, clear } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"pickup" | "courier">("pickup");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const cartLines = useMemo(() => {
    return items
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;
        const qty = Math.min(item.qty, product.stock);
        return {
          product,
          qty,
          sum: qty * product.price,
        };
      })
      .filter(Boolean) as { product: CatalogProduct; qty: number; sum: number }[];
  }, [items, productMap]);

  const subtotal = cartLines.reduce((sum, line) => sum + line.sum, 0);
  const deliveryFee = method === "courier" ? 350 : 0;
  const total = subtotal + deliveryFee;

  const canSubmit = customerName.trim() && phone.trim() && (method === "pickup" || address.trim());

  async function submitOrder() {
    setOrderMsg(null);

    if (!cartLines.length) {
      setOrderMsg("Корзина пуста.");
      return;
    }

    setLoadingSubmit(true);

    const payload = {
      customerName,
      phone,
      method,
      address: method === "courier" ? address : "",
      comment,
      items: cartLines.map((line) => ({ productId: line.product.id, qty: line.qty })),
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(initData ? { "X-TG-INIT-DATA": initData } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      setOrderMsg(data.error || "Ошибка оформления заказа");
      setLoadingSubmit(false);
      return;
    }

    clear();
    setCustomerName("");
    setPhone("");
    setMethod("pickup");
    setAddress("");
    setComment("");
    setOrderMsg(`Заявка создана ✅ Номер: ${data.orderId || data.id}. Менеджер подтвердит.`);

    window.Telegram?.WebApp?.showPopup?.({
      title: "Store 177",
      message: `Заявка создана ✅\nНомер: ${data.orderId || data.id}\nМенеджер подтвердит.`,
      buttons: [{ type: "ok" }],
    });

    setLoadingSubmit(false);
  }

  return (
    <PageContainer className="space-y-5">
      <AppHeader />

      <div className="space-y-3">
        <SectionTitle>Корзина</SectionTitle>
        <div className="text-base font-semibold text-slate-900">Проверьте ваш заказ</div>
      </div>

      {orderMsg ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{orderMsg}</Card>
      ) : null}

      {loading ? (
        <Card className="p-4 text-sm text-slate-600">Загружаем корзину...</Card>
      ) : cartLines.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-600">
          <div className="font-semibold text-slate-900">Пока пусто</div>
          <div className="mt-2">Добавьте товары из каталога.</div>
          <Link
            href="/"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-900"
          >
            Перейти в каталог
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {cartLines.map((line) => (
              <Card key={line.product.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{line.product.title}</div>
                    <div className="text-xs text-slate-500">{line.product.brand}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {formatMoney(line.product.price)}
                    </div>
                    <div className="text-xs text-slate-400">В наличии: {line.product.stock}</div>
                  </div>
                  <button
                    onClick={() => removeItem(line.product.id)}
                    className="text-slate-400 transition-colors hover:text-slate-600"
                    aria-label="Удалить товар"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQty(line.product.id, line.qty - 1, line.product.stock)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="min-w-[36px] text-center text-sm font-semibold">{line.qty}</div>
                    <button
                      onClick={() => setQty(line.product.id, line.qty + 1, line.product.stock)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{formatMoney(line.sum)}</div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Сумма</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Доставка</span>
              <span>{deliveryFee ? formatMoney(deliveryFee) : "Бесплатно"}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Итого</span>
              <span>{formatMoney(total)}</span>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="text-sm font-semibold text-slate-900">Данные для заявки</div>
            <Input placeholder="Имя" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            <Input placeholder="Телефон" value={phone} onChange={(event) => setPhone(event.target.value)} />

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={method === "pickup" ? "default" : "secondary"}
                onClick={() => setMethod("pickup")}
              >
                Самовывоз
              </Button>
              <Button
                type="button"
                variant={method === "courier" ? "default" : "secondary"}
                onClick={() => setMethod("courier")}
              >
                Курьер
              </Button>
            </div>

            {method === "courier" ? (
              <Input
                placeholder="Адрес доставки"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            ) : (
              <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-500">
                Самовывоз: адрес магазина уточнит менеджер.
              </div>
            )}

            <textarea
              placeholder="Комментарий"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />

            <Button type="button" onClick={submitOrder} disabled={!canSubmit || loadingSubmit}>
              {loadingSubmit ? "Отправляем..." : "Отправить заявку"}
            </Button>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
