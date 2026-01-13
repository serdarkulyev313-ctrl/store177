export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/tgVerify";
import { createProduct, deleteProduct, listAdminProducts, updateProduct } from "@/lib/db/products";

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

export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) {
    return NextResponse.json({ ok: false, error: a.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const products = await listAdminProducts();
  return NextResponse.json({ ok: true, products }, { headers: { "Cache-Control": "no-store" } });
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
    return NextResponse.json(
      { ok: false, error: "title/brand обязательны" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const product = await createProduct({
    title,
    brand,
    condition,
    description,
    price: Number(body?.price ?? 0),
    stock: Number(body?.stock ?? 0),
  });

  return NextResponse.json({ ok: true, product }, { headers: { "Cache-Control": "no-store" } });
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

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "id обязателен" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const next = await updateProduct(id, {
    title: patch?.title !== undefined ? String(patch.title).trim() : undefined,
    brand: patch?.brand !== undefined ? String(patch.brand).trim() : undefined,
    condition: patch?.condition === "used" ? "used" : patch?.condition === "new" ? "new" : undefined,
    description: patch?.description !== undefined ? String(patch.description).trim() : undefined,
    isActive: patch?.isActive !== undefined ? Boolean(patch.isActive) : undefined,
  });

  return NextResponse.json({ ok: true, product: next }, { headers: { "Cache-Control": "no-store" } });
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

  await deleteProduct(id);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
