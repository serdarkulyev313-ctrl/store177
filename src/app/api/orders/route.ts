export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import { tgSendMessage } from "@/lib/tgSend";
import { createOrder } from "@/lib/db/orders";

function getAdminIds(): number[] {
  const raw = process.env.ADMIN_TG_IDS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function money(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function safe(s: any) {
  return String(s ?? "").replace(/[<>]/g, "");
}

export async function POST(req: Request) {
  try {
    const initData = req.headers.get("x-tg-init-data") || "";

    // initData может отсутствовать при тестах в браузере
    let tgUserId: number | null = null;

    if (initData) {
      const v = verifyTelegramInitData(initData);
      if (!v.ok) {
        return NextResponse.json(
          { ok: false, error: v.error },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        );
      }
      tgUserId = v.user?.id ?? null;
    }

    const body = await req.json().catch(() => ({}));

    const customerName = String(body.customerName || "").trim();
    const phone = String(body.phone || "").trim();
    const method = body.method === "pickup" ? "pickup" : "courier";
    const address = method === "courier" ? String(body.address || "").trim() : "";
    const comment = String(body.comment || "").trim();

    const itemsIn = Array.isArray(body.items)
      ? (body.items as Array<{ productId?: string; id?: string; qty?: number }>)
      : [];

    if (!customerName || !phone) {
      return NextResponse.json(
        { ok: false, error: "name/phone required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (method === "courier" && !address) {
      return NextResponse.json(
        { ok: false, error: "address required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!itemsIn.length) {
      return NextResponse.json(
        { ok: false, error: "items required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const items = itemsIn.map((it) => ({
      productId: String(it.productId || it.id || "").trim(),
      qty: Number(it.qty || 0),
    }));

    if (items.some((item) => !item.productId || !Number.isFinite(item.qty) || item.qty <= 0)) {
      return NextResponse.json(
        { ok: false, error: "bad items" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const order = await createOrder({
      tgUserId,
      customerName,
      phone,
      method,
      address: method === "courier" ? address : null,
      comment,
      items,
    });

    // уведомление админу
    const admins = getAdminIds();
    const adminText =
      `<b>🛒 Новый заказ</b>\n` +
      `№ <b>${safe(order.id)}</b>\n` +
      `Клиент: <b>${safe(customerName)}</b>\n` +
      `Телефон: <b>${safe(phone)}</b>\n` +
      `Получение: <b>${method === "courier" ? "Курьер" : "Самовывоз"}</b>\n` +
      (method === "courier" ? `Адрес: <b>${safe(address)}</b>\n` : "") +
      (comment ? `Комментарий: <i>${safe(comment)}</i>\n` : "") +
      `\n<b>Состав:</b>\n` +
      order.items
        .map((x) => `• ${safe(x.titleSnapshot)} × ${x.qty} = <b>${money(x.priceSnapshot * x.qty)}</b>`)
        .join("\n") +
      `\n\nИтого: <b>${money(order.total)}</b>`;

    for (const adminId of admins) {
      await tgSendMessage(adminId, adminText);
    }

    // уведомление клиенту (если есть initData)
    if (tgUserId) {
      await tgSendMessage(
        tgUserId,
        `<b>Store 177</b>\nЗаявка принята ✅\nНомер заказа: <b>${safe(order.id)}</b>\nМенеджер скоро подтвердит.`
      );
    }

    return NextResponse.json({ ok: true, id: order.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("POST /api/orders failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
