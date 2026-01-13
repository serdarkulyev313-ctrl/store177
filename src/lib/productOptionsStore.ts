import fs from "fs";
import path from "path";

import { kvGetJson, kvSetJson } from "@/lib/kv";

export type OptionInputType = "select" | "radio" | "checkbox" | "text";

export type OptionGroup = {
  id: string;
  name: string;
  type: OptionInputType;
  required: boolean;
  values: string[]; // для select/radio/checkbox
};

export type VariantPriceMode = "delta" | "fixed" | "final";

export type ProductVariant = {
  id: string;
  options: Record<string, string | null>; // groupId -> value (или null если группа не обязательна)
  priceMode: VariantPriceMode; // delta = +/- к базовой цене товара, fixed/final = конечная цена
  priceValue: number;
  stock: number;
  sku?: string;
};

export type ProductOptions = {
  productId: string;
  groups: OptionGroup[];
  variants: ProductVariant[];
  updatedAt: string;
};

export type ProductOptionsInput = {
  productId: string;
  groups: OptionGroup[];
  variants: ProductVariant[];
};

const KV_KEY_PREFIX = "product-options:";
const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "productOptions.json");

function isKvConfigured() {
  return Boolean(
    process.env.KV_REST_API_URL ||
      process.env.KV_REST_API_TOKEN ||
      process.env.VERCEL_KV_REST_API_URL ||
      process.env.VERCEL_KV_REST_API_TOKEN
  );
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

function ensureFileStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, "{}", "utf-8");
}

function readFileDb(): Record<string, ProductOptions> {
  try {
    ensureFileStorage();
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    const json = JSON.parse(raw || "{}");
    if (json && typeof json === "object") return json as Record<string, ProductOptions>;
    return {};
  } catch {
    return {};
  }
}

function writeFileDb(db: Record<string, ProductOptions>) {
  ensureFileStorage();
  fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function kvKey(productId: string) {
  return `${KV_KEY_PREFIX}${productId}`;
}

export async function getProductOptions(productId: string): Promise<ProductOptions> {
  if (isKvConfigured()) {
    try {
      const existing = await kvGetJson<ProductOptions | null>(kvKey(productId), null);
      if (existing) return existing;
    } catch {
      // fallback to file storage
    }
  } else if (isVercelRuntime()) {
    throw new Error("KV не настроен. Укажите переменные окружения Vercel KV.");
  }

  const db = readFileDb();
  const fromFile = db[productId];
  if (fromFile) return fromFile;

  return {
    productId,
    groups: [],
    variants: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function saveProductOptions(opts: ProductOptions) {
  const next = { ...opts, updatedAt: new Date().toISOString() };
  if (isKvConfigured()) {
    try {
      await kvSetJson<ProductOptions>(kvKey(opts.productId), next);
      return;
    } catch {
      // fallback to file storage
    }
  } else if (isVercelRuntime()) {
    throw new Error("KV не настроен. Укажите переменные окружения Vercel KV.");
  }

  const db = readFileDb();
  db[opts.productId] = next;
  writeFileDb(db);
}

// ---------- Валидации ----------

export function normalizeGroupValues(values: string[]) {
  // trim, remove empty, keep order, remove duplicates (case-insensitive)
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = (v || "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function validateProductOptions(opts: ProductOptionsInput) {
  const errors: string[] = [];

  // groups
  const groupIds = new Set<string>();
  for (const g of opts.groups) {
    if (!g.id) errors.push("У группы опций нет id.");
    if (g.id && groupIds.has(g.id)) errors.push("Повторяющийся id у группы опций.");
    groupIds.add(g.id);

    if (!g.name?.trim()) errors.push("У группы опций нет названия.");

    if (g.type === "select" || g.type === "radio" || g.type === "checkbox") {
      const norm = normalizeGroupValues(g.values || []);
      if (norm.length === 0) errors.push(`Группа "${g.name || "(без названия)"}": нет значений.`);
    }
  }

  // variants required when groups exist
  if (opts.groups.length > 0 && opts.variants.length === 0) {
    errors.push("Если у товара есть группы опций — должен быть хотя бы 1 вариант.");
  }

  // variants structure
  const requiredGroups = opts.groups.filter((g) => g.required);

  for (const v of opts.variants) {
    if (!v.id) errors.push("У варианта нет id.");

    // must include all required groups
    for (const g of requiredGroups) {
      if (!(g.id in v.options) || v.options[g.id] == null || String(v.options[g.id]).trim() === "") {
        errors.push(`Вариант "${v.id}": не заполнена обязательная группа "${g.name}".`);
      }
    }

    // check values exist in group
    for (const g of opts.groups) {
      const val = v.options[g.id];
      if (val == null || String(val).trim() === "") continue; // допускаем null/пусто для необязательных
      if (g.type === "select" || g.type === "radio" || g.type === "checkbox") {
        const norm = normalizeGroupValues(g.values || []);
        const ok = norm.some((x) => x.toLowerCase() === String(val).trim().toLowerCase());
        if (!ok) errors.push(`Вариант "${v.id}": значение "${val}" отсутствует в группе "${g.name}".`);
      }
    }

    if (typeof v.stock !== "number" || v.stock < 0) errors.push(`Вариант "${v.id}": некорректный остаток.`);
    if (typeof v.priceValue !== "number") errors.push(`Вариант "${v.id}": некорректная цена.`);
    if (v.priceMode !== "delta" && v.priceMode !== "fixed" && v.priceMode !== "final") {
      errors.push(`Вариант "${v.id}": некорректный priceMode.`);
    }
  }

  // duplicates by options signature
  const sigSet = new Set<string>();
  for (const v of opts.variants) {
    const sig = JSON.stringify(
      Object.fromEntries(
        opts.groups.map((g) => [g.id, v.options[g.id] ?? null]) // фиксируем порядок групп
      )
    );
    if (sigSet.has(sig)) errors.push("Есть 2 одинаковых варианта (одинаковые выбранные опции).");
    sigSet.add(sig);
  }

  return errors;
}
