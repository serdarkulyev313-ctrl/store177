export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import { listProductImages } from "@/lib/db/products";

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
  return NextResponse.json(
    { ok: false, error: msg },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const v = verifyTelegramInitData(initData, token);
  if (!v.ok) return deny("Неверный initData.");

  const adminIds = getAdminIds();
  if (!adminIds.includes(v.user!.id)) return deny();

  const url = new URL(req.url);
  const productId = url.searchParams.get("productId") || "";
  if (!productId) {
    return NextResponse.json(
      { ok: false, error: "productId обязателен" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const images = await listProductImages(productId);
  return NextResponse.json({ ok: true, images }, { headers: { "Cache-Control": "no-store" } });
}
