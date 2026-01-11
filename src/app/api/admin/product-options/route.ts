// src/app/api/admin/product-options/route.ts
import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import { kvGetJson, kvSetJson } from "@/lib/kv";

/**
 * ВАЖНО:
 * Админка шлёт x-tg-init-data (initData).
 * Мы проверяем подпись и то, что пользователь есть в ADMIN_TG_IDS.
 */

function getAdminIds(): number[] {
  const raw = process.env.ADMIN_TG_IDS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function isAdmin(tgUserId: number) {
  return getAdminIds().includes(tgUserId);
}

function requireAdmin(initData: string) {
  const v = verifyTelegramInitData(initData);
  if (!v.ok) return { ok: false as const, error: "initData невалиден" };
  if (!v.user?.id) return { ok: false as const, error: "user отсутствует" };
  if (!isAdmin(v.user.id)) return { ok: false as const, error: "нет прав админа" };
  return { ok: true as const, userId: v.user.id };
}

/**
 * Хранилище:
 * KV key: productOptions:<productId>
 * value: { optionGroups: [...], variants: [...] }
 */
type ProductOptionsPayload = {
  productId: string;
  optionGroups: any[];
  variants: any[];
};

function keyFor(productId: string) {
  return `productOptions:${productId}`;
}

// Получить сохранённые опции/варианты товара
export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: 403 });

  const url = new URL(req.url);
  const productId = (url.searchParams.get("productId") || "").trim();
  if (!productId) return NextResponse.json({ ok: false, error: "productId обязателен" }, { status: 400 });

  const data = await kvGetJson<{ optionGroups: any[]; variants: any[] }>(keyFor(productId), {
    optionGroups: [],
    variants: [],
  });

  return NextResponse.json({ ok: true, productId, ...data });
}

// Сохранить опции/варианты товара
export async function PUT(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Partial<ProductOptionsPayload>;

  const productId = String(body?.productId || "").trim();
  const optionGroups = Array.isArray(body?.optionGroups) ? body!.optionGroups : [];
  const variants = Array.isArray(body?.variants) ? body!.variants : [];

  if (!productId) return NextResponse.json({ ok: false, error: "productId обязателен" }, { status: 400 });

  // Мини-защита: чтобы не улетал мусор
  if (!Array.isArray(optionGroups) || !Array.isArray(variants)) {
    return NextResponse.json({ ok: false, error: "optionGroups/variants должны быть массивами" }, { status: 400 });
  }

  await kvSetJson(keyFor(productId), { optionGroups, variants });

  return NextResponse.json({ ok: true });
}
