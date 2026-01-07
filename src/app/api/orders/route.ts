export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import { readProducts, writeProducts } from "@/lib/productsStore";
import { makeOrderId, readOrders, writeOrders } from "@/lib/ordersStore";
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

function money(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function safe(s: any) {
  return String(s ?? "").replace(/[<>]/g, "");
}

function asArrayProducts(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.products)) return data.products;
  return [];
}

function asArrayOrders(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.orders)) return data.orders;
  return [];
}

export async function POST(req: Request) {
  try {
    const initData = req.headers.get("x-tg-init-data") || "";

    // initData может отсутствовать при тестах в браузере
    let tgUserId: number | null = null;

    if (initData) {
      const v = verifyTelegramInitData(initData);
      if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 401 });
      tgUserId = v.user?.id ?? null;
    }

    const body = await req.json().catch(() => ({}));

    const customerName = String(body.customerName || "").trim();
    const phone = String(body.phone || "").trim();
    const method = body.method === "pickup" ? "pickup" : "courier";
    const address = method === "courier" ? String(body.address || "").trim() : "";
    const comment = String(body.comment || "").trim();

    const itemsIn = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !phone) {
      return NextResponse.json({ ok: false, error: "name/phone required" }, { status: 400 });
    }
    if (method === "courier" && !address) {
      return NextResponse.json({ ok: false, error: "address required" }, { status: 400 });
    }
    if (!itemsIn.length) {
      return NextResponse.json({ ok: false, error: "items required" }, { status: 400 });
    }

    // ✅ ВАЖНО: await (на случай если readProducts async)
    const productsRaw = await readProducts();
    const products = asArrayProducts(productsRaw);

    if (!Array.isArray(products) || !products.length) {
      return NextResponse.json({ ok: false, error: "products store empty or invalid" }, { status: 500 });
    }

    const orderItems: { productId: string; title: string; price: number; qty: number }[] = [];
    let total = 0;

    for (const it of itemsIn) {
      const productId = String(it.productId || it.id || "").trim();
      const qty = Number(it.qty || 0);

      if (!productId || !Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ ok: false, error: "bad items" }, { status: 400 });
      }

      const p = products.find((x: any) => x.id === productId);
      if (!p) return NextResponse.json({ ok: false, error: `product not found: ${productId}` }, { status: 404 });

      if (Number(p.stock) < qty) {
        return NextResponse.json({ ok: false, error: `not enough stock: ${p.title}` }, { status: 400 });
      }

      const price = Number(p.price);
      orderItems.push({
        productId,
        title: String(p.title),
        price,
        qty,
      });

      total += price * qty;
    }

    // списываем остатки
    const updatedProducts = products.map((p: any) => {
      const hit = orderItems.find((x) => x.productId === p.id);
      if (!hit) return p;
      return { ...p, stock: Number(p.stock) - hit.qty };
    });

    // ✅ ВАЖНО: await (на случай если writeProducts async)
    await writeProducts(updatedProducts);

    // ✅ ВАЖНО: await (на случай если readOrders async)
    const ordersRaw = await readOrders();
    const orders = asArrayOrders(ordersRaw);

    const id = makeOrderId();

    const order: any = {
      id,
      createdAt: new Date().toISOString(),

      tgUserId,
      customerName,
      phone,
      method,
      address: method === "courier" ? address : null,
      comment: comment ? comment : null,

      items: orderItems,
      total,

      orderStatus: "created",
      paymentStatus: "unpaid",
    };

    orders.push(order);

    // ✅ ВАЖНО: await (на случай если writeOrders async)
    await writeOrders(orders);

    // уведомление админу
    const admins = getAdminIds();
    const adminText =
      `<b>🛒 Новый заказ</b>\n` +
      `№ <b>${safe(id)}</b>\n` +
      `Клиент: <b>${safe(customerName)}</b>\n` +
      `Телефон: <b>${safe(phone)}</b>\n` +
      `Получение: <b>${method === "courier" ? "Курьер" : "Самовывоз"}</b>\n` +
      (method === "courier" ? `Адрес: <b>${safe(address)}</b>\n` : "") +
      (comment ? `Комментарий: <i>${safe(comment)}</i>\n` : "") +
      `\n<b>Состав:</b>\n` +
      orderItems.map((x) => `• ${safe(x.title)} × ${x.qty} = <b>${money(x.price * x.qty)}</b>`).join("\n") +
      `\n\nИтого: <b>${money(total)}</b>`;

    for (const adminId of admins) {
      await tgSendMessage(adminId, adminText);
    }

    // уведомление клиенту (если есть initData)
    if (tgUserId) {
      await tgSendMessage(
        tgUserId,
        `<b>Store 177</b>\nЗаявка принята ✅\nНомер заказа: <b>${safe(id)}</b>\nМенеджер скоро подтвердит.`
      );
    }

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    console.error("POST /api/orders failed:", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
