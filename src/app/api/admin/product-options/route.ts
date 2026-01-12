import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import { getProductOptions, saveProductOptions, validateProductOptions, ProductOptions } from "@/lib/productOptionsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const opts = await getProductOptions(productId);
  return NextResponse.json(
    { ok: true, options: opts },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handleWrite(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const v = verifyTelegramInitData(initData, token);
  if (!v.ok) return deny("Неверный initData.");

  const adminIds = getAdminIds();
  if (!adminIds.includes(v.user!.id)) return deny();

  const body = (await req.json()) as { options?: ProductOptions };
  if (!body?.options?.productId) {
    return NextResponse.json(
      { ok: false, error: "options.productId обязателен" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if ((body.options.groups?.length ?? 0) === 0 && (body.options.variants?.length ?? 0) === 0) {
    return NextResponse.json(
      { ok: false, error: "Нельзя сохранить пустые опции." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const errors = validateProductOptions(body.options);
  if (errors.length) {
    return NextResponse.json(
      { ok: false, error: errors.join("\n") },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  await saveProductOptions(body.options);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  return handleWrite(req);
}

export async function POST(req: Request) {
  return handleWrite(req);
}
