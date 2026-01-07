export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import { readOrders, writeOrders, Order } from "@/lib/ordersStore";
import { tgSendMessage } from "@/lib/tgSend";

function getAdminIds(): number[] {
  const raw = process.env.ADMIN_TG_IDS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function requireAdmin(initData: string) {
  const v = verifyTelegramInitData(initData);
  if (!v.ok) return { ok: false as const, error: v.error };
  const uid = v.user?.id;
  if (!uid) return { ok: false as const, error: "no user id" };
  if (!getAdminIds().includes(uid)) return { ok: false as const, error: "forbidden" };
  return { ok: true as const, userId: uid };
}

const ORDER_STATUS_RU: Record<string, string> = {
  created: "Создан",
  confirmed: "Подтверждён",
  cancelled: "Отменён",
  completed: "Завершён",
};

const PAYMENT_STATUS_RU: Record<string, string> = {
  unpaid: "Не оплачен",
  paid_cash: "Оплачен наличными",
};

function safe(s: any) {
  return String(s ?? "").replace(/[<>]/g, "");
}

function money(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function buildClientMessage(order: Order, changed: { orderStatus?: string; paymentStatus?: string }) {
  const lines: string[] = [];
  lines.push(`<b>Store 177</b>`);
  lines.push(`Заказ <b>${safe(order.id)}</b>`);

  if (changed.orderStatus) lines.push(`Статус: <b>${ORDER_STATUS_RU[changed.orderStatus] || changed.orderStatus}</b>`);
  if (changed.paymentStatus) lines.push(`Оплата: <b>${PAYMENT_STATUS_RU[changed.paymentStatus] || changed.paymentStatus}</b>`);

  lines.push(`Получение: <b>${order.method === "courier" ? "Курьер" : "Самовывоз"}</b>`);
  lines.push(`Итого: <b>${money(order.total)}</b>`);
  return lines.join("\n");
}

export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: 403 });

  const orders = readOrders().sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || ""));

  return NextResponse.json(
    { ok: true, orders },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id, orderStatus, paymentStatus } = body || {};
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const orders = readOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return NextResponse.json({ ok: false, error: "order not found" }, { status: 404 });

  const before = orders[idx];

  const changed: { orderStatus?: string; paymentStatus?: string } = {};
  if (orderStatus && orderStatus !== before.orderStatus) changed.orderStatus = orderStatus;
  if (paymentStatus && paymentStatus !== before.paymentStatus) changed.paymentStatus = paymentStatus;

  const updated: Order = {
    ...before,
    ...(orderStatus ? { orderStatus } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    updatedAt: new Date().toISOString(),
  };

  orders[idx] = updated;
  writeOrders(orders);

  if (updated.tgUserId && (changed.orderStatus || changed.paymentStatus)) {
    await tgSendMessage(updated.tgUserId, buildClientMessage(updated, changed));
  }

  return NextResponse.json({ ok: true });
}
