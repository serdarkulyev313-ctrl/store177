export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import { createProductImage } from "@/lib/db/products";

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

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "BLOB_READ_WRITE_TOKEN не задан" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
  const initData = req.headers.get("x-tg-init-data") || "";
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const v = verifyTelegramInitData(initData, token);
  if (!v.ok) return deny("Неверный initData.");

  const adminIds = getAdminIds();
  if (!adminIds.includes(v.user!.id)) return deny();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const productId = String(formData.get("productId") || "").trim();

  if (!file || !productId) {
    return NextResponse.json(
      { ok: false, error: "file и productId обязательны" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const blob = await put(`products/${productId}/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  const image = await createProductImage(productId, blob.url);

  return NextResponse.json(
    { ok: true, url: blob.url, image },
    { headers: { "Cache-Control": "no-store" } }
  );
}
