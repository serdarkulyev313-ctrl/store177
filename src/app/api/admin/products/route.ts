export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

import { verifyTelegramInitData } from "@/lib/tgVerify";
import { validateOptionGroups, validateVariants } from "@/lib/productValidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pricing = { mode: "final" | "from"; value: number };

type Variant = {
  id: string;
  selections: Record<string, string>;
  pricing: Pricing;
  oldPrice: number | null;
  stock: number;
  isActive: boolean;
};

export type Product = {
  id: string;
  title: string;
  brand: string;
  condition: "new" | "used";
  optionGroups: any[];
  variants: Variant[];
  createdAt: string;
  updatedAt: string;

  // чтобы не падало, если где-то доп.поля
  [key: string]: any;
};

const PRODUCTS_KEY = "store177:products";

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

function makeProductId() {
  // nodejs runtime в Vercel поддерживает crypto.randomUUID()
  // на всякий: fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeVariantId(productId: string) {
  return `${productId}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readProducts(): Promise<Product[]> {
  const data = (await kv.get<Product[] | null>(PRODUCTS_KEY)) ?? null;
  return Array.isArray(data) ? data : [];
}

async function writeProducts(products: Product[]) {
  await kv.set(PRODUCTS_KEY, products);
}

export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) {
    return NextResponse.json({ ok: false, error: a.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const products = await readProducts();
  return NextResponse.json(
    { ok: true, products },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) {
    return NextResponse.json({ ok: false, error: a.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  const brand = String(body?.brand || "").trim();
  const condition = body?.condition === "used" ? "used" : "new";
  const description = body?.description ? String(body.description).trim() : undefined;

  if (!title || !brand) {
    return NextResponse.json({ ok: false, error: "title/brand обязательны" }, { status: 400 });
  }

  const products = await readProducts();
  const id = makeProductId();

  const product = await createProduct({
    title,
    brand,
    condition,
    optionGroups: [],
    variants: [
      {
        id: makeVariantId(id),
        selections: {},
        pricing: { mode: "final", value: Number(body?.price ?? 0) },
        oldPrice: null,
        stock: Number(body?.stock ?? 0),
        isActive: true,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  products.unshift(p);
  await writeProducts(products);

  return NextResponse.json({ ok: true, product: p });
}

export async function PATCH(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) {
    return NextResponse.json({ ok: false, error: a.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const patch = body?.patch || {};

  if (!id) return NextResponse.json({ ok: false, error: "id обязателен" }, { status: 400 });

  const products = await readProducts();
  const idx = products.findIndex((p) => p.id === id);
  if (idx < 0) return NextResponse.json({ ok: false, error: "product not found" }, { status: 404 });

  const prev = products[idx];

  const next: Product = {
    ...prev,
    ...patch,

    // защита от мусора
    title: patch?.title !== undefined ? String(patch.title).trim() : prev.title,
    brand: patch?.brand !== undefined ? String(patch.brand).trim() : prev.brand,
    condition: patch?.condition === "used" ? "used" : patch?.condition === "new" ? "new" : prev.condition,

    optionGroups: Array.isArray(patch?.optionGroups) ? patch.optionGroups : prev.optionGroups,
    variants: Array.isArray(patch?.variants) ? patch.variants : prev.variants,

    updatedAt: new Date().toISOString(),
  };

  // Валидации опций и вариантов
  const vg = validateOptionGroups(next.optionGroups || []);
  if (!vg.ok) return NextResponse.json({ ok: false, error: vg.error }, { status: 400 });

  const vv = validateVariants(next.optionGroups || [], next.variants || []);
  if (!vv.ok) return NextResponse.json({ ok: false, error: vv.error }, { status: 400 });

  products[idx] = next;
  await writeProducts(products);

  return NextResponse.json({ ok: true, product: next });
}

export async function DELETE(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) {
    return NextResponse.json({ ok: false, error: a.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "id обязателен" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const products = await readProducts();
  const next = products.filter((p) => p.id !== id);
  await writeProducts(next);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
