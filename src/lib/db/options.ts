import { prisma } from "@/lib/db/client";

export type OptionGroupInput = {
  id: string;
  name: string;
  type: "select" | "radio" | "checkbox" | "text";
  required: boolean;
  values: string[];
};

export type VariantInput = {
  id: string;
  options: Record<string, string | null>;
  priceMode: "delta" | "fixed" | "final";
  priceValue: number;
  stock: number;
  sku?: string;
  oldPrice?: number | null;
};

export type ProductOptionsPayload = {
  productId: string;
  groups: OptionGroupInput[];
  variants: VariantInput[];
};

export async function getProductOptions(productId: string): Promise<ProductOptionsPayload> {
  const groups = await prisma.optionGroup.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
    include: { values: { orderBy: { sortOrder: "asc" } } },
  });

  const variants = await prisma.variant.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
    include: { selections: true },
  });

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  return {
    productId,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      type: group.type as any,
      required: group.required,
      values: group.values.map((val) => val.value),
    })),
    variants: variants.map((variant) => {
      const options: Record<string, string | null> = {};
      for (const sel of variant.selections) {
        if (!groupMap.has(sel.groupId)) continue;
        options[sel.groupId] = sel.value ?? null;
      }
      return {
        id: variant.id,
        options,
        priceMode: variant.priceMode as any,
        priceValue: variant.priceValue,
        stock: variant.stock,
        sku: variant.sku ?? undefined,
        oldPrice: variant.oldPrice ?? null,
      };
    }),
  };
}

export async function saveProductOptions(payload: ProductOptionsPayload) {
  const { productId, groups, variants } = payload;

  await prisma.$transaction(async (tx) => {
    await tx.variantSelection.deleteMany({ where: { variant: { productId } } });
    await tx.variant.deleteMany({ where: { productId } });
    await tx.optionValue.deleteMany({ where: { group: { productId } } });
    await tx.optionGroup.deleteMany({ where: { productId } });

    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      await tx.optionGroup.create({
        data: {
          id: group.id,
          productId,
          name: group.name,
          type: group.type,
          required: group.required,
          sortOrder: i,
          values: {
            create: group.values.map((value, idx) => ({
              id: `${group.id}_${idx}`,
              value,
              sortOrder: idx,
            })),
          },
        },
      });
    }

    const values = await tx.optionValue.findMany({
      where: { group: { productId } },
      include: { group: true },
    });

    const valueMap = new Map<string, string>();
    for (const val of values) {
      valueMap.set(`${val.groupId}:${val.value.toLowerCase()}`, val.id);
    }

    for (const variant of variants) {
      await tx.variant.create({
        data: {
          id: variant.id,
          productId,
          sku: variant.sku ?? null,
          priceMode: variant.priceMode,
          priceValue: Number(variant.priceValue ?? 0),
          oldPrice: variant.oldPrice ?? null,
          stock: Number(variant.stock ?? 0),
          isActive: true,
          selections: {
            create: Object.entries(variant.options || {}).map(([groupId, value]) => {
              const valString = value ?? "";
              const key = `${groupId}:${valString.toLowerCase()}`;
              const optionValueId = valueMap.get(key);
              return {
                groupId,
                value: valString,
                optionValueId: optionValueId ?? null,
              };
            }),
          },
        },
      });
    }
  });
}
