import fs from "fs";
import path from "path";

export type Condition = "new" | "used";
export type OptionInputType = "select" | "radio" | "checkbox" | "text";

export type OptionValue = { id: string; label: string };

export type OptionGroup = {
  id: string;
  name: string;
  type: OptionInputType;
  required: boolean;
  values?: OptionValue[];
};

export type VariantSelectionValue = string | string[];

export type ProductVariant = {
  id: string;
  selections: Record<string, VariantSelectionValue>;
  sku?: string;
  pricing: { mode: "final" | "delta"; value: number };
  oldPrice: number | null;
  stock: number;
  isActive: boolean;
};

export type Product = {
  id: string;
  title: string;
  brand: string;
  condition: Condition;

  optionGroups: OptionGroup[];
  variants: ProductVariant[];

  createdAt: string;
  updatedAt?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, "[]", "utf-8");
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-6)}`;
}

export function makeProductId() {
  return uid("p");
}
export function makeGroupId() {
  return uid("g");
}
export function makeValueId(groupId: string) {
  return uid(`val_${groupId}`);
}
export function makeVariantId(productId: string) {
  return uid(`v_${productId}`);
}

function now() {
  return new Date().toISOString();
}

function migrateLegacyProduct(p: any): Product {
  const productId = String(p?.id || makeProductId());

  if (Array.isArray(p?.optionGroups) && Array.isArray(p?.variants) && p.variants[0]?.selections) {
    return {
      id: productId,
      title: String(p.title || "").trim(),
      brand: String(p.brand || "").trim(),
      condition: p.condition === "used" ? "used" : "new",
      optionGroups: p.optionGroups,
      variants: p.variants,
      createdAt: String(p.createdAt || now()),
      updatedAt: String(p.updatedAt || now()),
    };
  }

  const legacyVariants = Array.isArray(p?.variants) ? p.variants : [];
  if (!legacyVariants.length && (p?.price !== undefined || p?.stock !== undefined)) {
    legacyVariants.push({
      id: makeVariantId(productId),
      color: "",
      memory: "",
      price: Number(p.price ?? 0),
      oldPrice: p.oldPrice ?? null,
      stock: Number(p.stock ?? 0),
    });
  }

  const memSet = new Map<string, string>();
  const colSet = new Map<string, string>();

  const memoryGroupId = makeGroupId();
  const colorGroupId = makeGroupId();

  for (const v of legacyVariants) {
    const mem = String(v?.memory ?? "").trim();
    const col = String(v?.color ?? "").trim();

    if (mem && !memSet.has(mem)) memSet.set(mem, makeValueId(memoryGroupId));
    if (col && !colSet.has(col)) colSet.set(col, makeValueId(colorGroupId));
  }

  const optionGroups: OptionGroup[] = [];

  if (memSet.size > 0) {
    optionGroups.push({
      id: memoryGroupId,
      name: "Память",
      type: "select",
      required: true,
      values: Array.from(memSet.entries()).map(([label, id]) => ({ id, label })),
    });
  }
  if (colSet.size > 0) {
    optionGroups.push({
      id: colorGroupId,
      name: "Цвет",
      type: "select",
      required: true,
      values: Array.from(colSet.entries()).map(([label, id]) => ({ id, label })),
    });
  }

  const variants: ProductVariant[] = legacyVariants.map((lv: any) => {
    const mem = String(lv?.memory ?? "").trim();
    const col = String(lv?.color ?? "").trim();

    const selections: Record<string, VariantSelectionValue> = {};
    if (memSet.size > 0) selections[memoryGroupId] = mem ? memSet.get(mem)! : "";
    if (colSet.size > 0) selections[colorGroupId] = col ? colSet.get(col)! : "";

    return {
      id: String(lv?.id || makeVariantId(productId)),
      selections,
      sku: lv?.sku ? String(lv.sku) : undefined,
      pricing: { mode: "final", value: Number(lv?.price ?? 0) },
      oldPrice: lv?.oldPrice === null || lv?.oldPrice === undefined ? null : Number(lv.oldPrice),
      stock: Number(lv?.stock ?? 0),
      isActive: lv?.isActive === false ? false : true,
    };
  });

  if (variants.length === 0) {
    variants.push({
      id: makeVariantId(productId),
      selections: {},
      pricing: { mode: "final", value: 0 },
      oldPrice: null,
      stock: 0,
      isActive: true,
    });
  }

  return {
    id: productId,
    title: String(p?.title || "").trim(),
    brand: String(p?.brand || "").trim(),
    condition: p?.condition === "used" ? "used" : "new",
    optionGroups,
    variants,
    createdAt: String(p?.createdAt || now()),
    updatedAt: String(p?.updatedAt || now()),
  };
}

export function readProducts(): Product[] {
  try {
    ensureStorage();
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed?.products;
    if (!Array.isArray(arr)) return [];

    const migrated = arr.map(migrateLegacyProduct).filter((p) => p.title && p.brand);
    return migrated;
  } catch {
    return [];
  }
}

export function writeProducts(products: Product[]) {
  ensureStorage();
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
}

export function viewProductForCatalog(p: Product) {
  const v = (p.variants || []).find((x) => x.isActive) || p.variants?.[0];
  return {
    id: p.id,
    title: p.title,
    brand: p.brand,
    condition: p.condition,
    optionGroups: p.optionGroups || [],
    price: v ? (v.pricing?.mode === "final" ? v.pricing.value : v.pricing.value) : 0,
    oldPrice: v ? v.oldPrice : null,
    stock: v ? v.stock : 0,
  };
}

export function findVariantBySelections(p: Product, selections: Record<string, VariantSelectionValue>) {
  const groups = (p.optionGroups || []).filter((g) => g.type !== "text");
  const required = groups.filter((g) => g.required);

  for (const g of required) {
    const sel = selections[g.id];
    const bad = sel === undefined || sel === null || sel === "" || (Array.isArray(sel) && sel.length === 0);
    if (bad) return null;
  }

  return (
    (p.variants || []).find((v) => {
      if (!v.isActive) return false;
      for (const g of groups) {
        const a = v.selections?.[g.id];
        const b = selections[g.id];

        if (Array.isArray(a) || Array.isArray(b)) {
          const aa = Array.isArray(a) ? a.slice().sort() : [];
          const bb = Array.isArray(b) ? b.slice().sort() : [];
          if (aa.length !== bb.length) return false;
          for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
        } else {
          if (String(a ?? "") !== String(b ?? "")) return false;
        }
      }
      return true;
    }) || null
  );
}
