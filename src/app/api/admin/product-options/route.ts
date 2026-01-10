import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import {
  getProductOptions,
  saveProductOptions,
  validateProductOptions,
  ProductOptions,
} from "@/lib/productOptionsStore";

function getAdminIds(): number[] {
  const raw = process.env.ADMIN_TG_IDS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function deny(msg = "Нет доступа.") {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const v = verifyTelegramInitData(initData);
  if (!v.ok) return deny("Неверный initData.");

  const adminIds = getAdminIds();
  const uid = v.user?.id;
  if (!uid || !adminIds.includes(uid)) return deny();

  const url = new URL(req.url);
  const productId = url.searchParams.get("productId") || "";
  if (!productId)
    return NextResponse.json(
      { ok: false, error: "productId обязателен" },
      { status: 400 }
    );

  const opts = getProductOptions(productId);
  return NextResponse.json({ ok: true, options: opts });
}

export async function PUT(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const v = verifyTelegramInitData(initData);
  if (!v.ok) return deny("Неверный initData.");

  const adminIds = getAdminIds();
  const uid = v.user?.id;
  if (!uid || !adminIds.includes(uid)) return deny();

  const body = (await req.json()) as { options?: ProductOptions };
  if (!body?.options?.productId)
    return NextResponse.json(
      { ok: false, error: "options.productId обязателен" },
      { status: 400 }
    );

  const errors = validateProductOptions(body.options);
  if (errors.length)
    return NextResponse.json(
      { ok: false, error: errors.join("\n") },
      { status: 400 }
    );

  saveProductOptions(body.options);
  return NextResponse.json({ ok: true });
}
