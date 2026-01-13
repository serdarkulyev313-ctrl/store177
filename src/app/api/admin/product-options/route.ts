import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram";
import { kvGetJson, kvSetJson } from "@/lib/kv";

type OptionGroup = {
  id: string;
  name: string;
  type: "select" | "radio" | "checkbox" | "text";
  required?: boolean;
  values?: string[];
};

type Variant = {
  id: string;
  options: Record<string, string>; // groupId -> selected value
  priceMode: "fixed" | "delta" | "final";
  priceValue: number;
  sku?: string;
  stock?: number;
  isActive?: boolean;
};

type ProductOptionsStored = {
  optionGroups: OptionGroup[];
  variants: Variant[];
};

type ProductOptionsPayloadV1 = {
  productId: string;
  optionGroups: OptionGroup[];
  variants: Variant[];
};

type ProductOptionsPayloadV2 = {
  productId: string;
  options: {
    groups?: OptionGroup[];       // old client
    optionGroups?: OptionGroup[]; // alternative naming
    variants?: Variant[];
  };
};

function keyFor(productId: string) {
  return `product-options:${productId}`;
}

function requireAdmin(initData: string) {
  const v = verifyTelegramInitData(initData);
  if (!v.ok) return { ok: false as const, error: v.error };

  const adminIds = String(process.env.ADMIN_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (adminIds.length === 0) {
    return { ok: false as const, error: "ADMIN_IDS не настроен" };
  }

  const userId = String(v.user?.id || "");
  if (!adminIds.includes(userId)) {
    return { ok: false as const, error: "Доступ запрещён" };
  }

  return { ok: true as const, user: v.user };
}

function asArray<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function normalizeBody(body: any): { productId: string; optionGroups: OptionGroup[]; variants: Variant[] } {
  const productId = String(body?.productId || "").trim();

  // Support BOTH payload formats:
  // 1) { productId, optionGroups, variants }
  // 2) { productId, options: { groups, variants } }
  const optionGroups =
    asArray<OptionGroup>(body?.optionGroups) ||
    asArray<OptionGroup>(body?.options?.optionGroups) ||
    asArray<OptionGroup>(body?.options?.groups);

  const variants =
    asArray<Variant>(body?.variants) ||
    asArray<Variant>(body?.options?.variants);

  // Important: the `||` above won't work for arrays because [] is truthy.
  // So we must pick the first NON-empty candidate manually.
  const pick = <T>(...cands: T[][]) => (cands.find((a) => Array.isArray(a) && a.length > 0) ?? []);
  const finalGroups = pick(
    asArray<OptionGroup>(body?.optionGroups),
    asArray<OptionGroup>(body?.options?.optionGroups),
    asArray<OptionGroup>(body?.options?.groups)
  );
  const finalVariants = pick(
    asArray<Variant>(body?.variants),
    asArray<Variant>(body?.options?.variants)
  );

  return { productId, optionGroups: finalGroups, variants: finalVariants };
}

function sanitizeStored(data: { optionGroups: any[]; variants: any[] }): ProductOptionsStored {
  const optionGroups = asArray<OptionGroup>(data.optionGroups)
    .filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
    .map((g) => ({
      id: String(g.id),
      name: String(g.name),
      type: (g.type as any) || "select",
      required: Boolean(g.required),
      values: asArray<string>(g.values).map(String),
    }));

  const variants = asArray<Variant>(data.variants)
    .filter((v) => v && typeof v.id === "string" && v.options && typeof v.options === "object")
    .map((v) => ({
      id: String(v.id),
      options: Object.fromEntries(Object.entries(v.options || {}).map(([k, val]) => [String(k), String(val)])),
      priceMode: (v.priceMode as any) || "fixed",
      priceValue: Number(v.priceValue ?? 0),
      sku: v.sku ? String(v.sku) : undefined,
      stock: v.stock == null ? undefined : Number(v.stock),
      isActive: v.isActive == null ? undefined : Boolean(v.isActive),
    }));

  return { optionGroups, variants };
}

export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: 403 });

  const url = new URL(req.url);
  const productId = (url.searchParams.get("productId") || "").trim();
  if (!productId) {
    return NextResponse.json({ ok: false, error: "productId обязателен" }, { status: 400 });
  }

  const data = await kvGetJson<ProductOptionsStored>(keyFor(productId), {
    optionGroups: [],
    variants: [],
  });

  return NextResponse.json(
    { ok: true, productId, ...data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handleWrite(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const a = requireAdmin(initData);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: 403 });

  const raw = (await req.json().catch(() => ({}))) as Partial<
    ProductOptionsPayloadV1 & ProductOptionsPayloadV2
  >;

  const { productId, optionGroups, variants } = normalizeBody(raw);

  if (!productId) {
    return NextResponse.json({ ok: false, error: "productId обязателен" }, { status: 400 });
  }

  const stored = sanitizeStored({ optionGroups, variants });

  await kvSetJson(keyFor(productId), stored);

  return NextResponse.json(
    {
      ok: true,
      productId,
      saved: { optionGroups: stored.optionGroups.length, variants: stored.variants.length },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(req: Request) {
  return handleWrite(req);
}

// Если фронт шлёт POST (часто так бывает) — оставь тоже:
export async function POST(req: Request) {
  return handleWrite(req);
}
