import { prisma } from "@/lib/db/client";

export type CatalogProduct = {
  id: string;
  title: string;
  brand: string;
  description?: string | null;
  condition: "new" | "used";
  isActive: boolean;
  imageUrl: string | null;
  price: number;
  oldPrice: number | null;
  stock: number;
  optionGroups: { id: string; name: string; type: string; required: boolean; values: string[] }[];
};

export type AdminProduct = {
  id: string;
  title: string;
  brand: string;
  description?: string | null;
  condition: "new" | "used";
  isActive: boolean;
  imageUrls: string[];
  price?: number;
  stock?: number;
};

export async function listProductsForCatalog(): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      optionGroups: { include: { values: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return products.map((product) => {
    const variant = product.variants[0];
    return {
      id: product.id,
      title: product.title,
      brand: product.brand,
      description: product.description,
      condition: product.condition === "used" ? "used" : "new",
      isActive: product.isActive,
      imageUrl: product.images[0]?.url ?? null,
      price: variant ? variant.priceValue : 0,
      oldPrice: variant?.oldPrice ?? null,
      stock: variant ? variant.stock : 0,
      optionGroups: product.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        required: group.required,
        values: group.values.map((val) => val.value),
      })),
    };
  });
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const products = await prisma.product.findMany({
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return products.map((product) => {
    const variant = product.variants[0];
    return {
      id: product.id,
      title: product.title,
      brand: product.brand,
      description: product.description,
      condition: product.condition === "used" ? "used" : "new",
      isActive: product.isActive,
      imageUrls: product.images.map((image) => image.url),
      price: variant?.priceValue ?? undefined,
      stock: variant?.stock ?? undefined,
    };
  });
}

export async function getAdminProductById(id: string): Promise<AdminProduct | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!product) return null;
  const variant = product.variants[0];
  return {
    id: product.id,
    title: product.title,
    brand: product.brand,
    description: product.description,
    condition: product.condition === "used" ? "used" : "new",
    isActive: product.isActive,
    imageUrls: product.images.map((image) => image.url),
    price: variant?.priceValue ?? undefined,
    stock: variant?.stock ?? undefined,
  };
}

export async function createProduct(input: {
  title: string;
  brand: string;
  condition: "new" | "used";
  description?: string;
  price?: number;
  stock?: number;
}) {
  const product = await prisma.product.create({
    data: {
      title: input.title,
      brand: input.brand,
      condition: input.condition,
      description: input.description ?? null,
      isActive: true,
      variants: {
        create: {
          priceMode: "final",
          priceValue: Number(input.price ?? 0),
          stock: Number(input.stock ?? 0),
          isActive: true,
        },
      },
    },
  });

  return product;
}

export async function updateProduct(id: string, patch: {
  title?: string;
  brand?: string;
  condition?: "new" | "used";
  description?: string | null;
  isActive?: boolean;
}) {
  return prisma.product.update({
    where: { id },
    data: {
      title: patch.title,
      brand: patch.brand,
      condition: patch.condition,
      description: patch.description ?? undefined,
      isActive: patch.isActive,
    },
  });
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
}

export async function listProductImages(productId: string) {
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createProductImage(productId: string, url: string) {
  const last = await prisma.productImage.findFirst({
    where: { productId },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = last ? last.sortOrder + 1 : 0;
  return prisma.productImage.create({
    data: {
      productId,
      url,
      sortOrder,
    },
  });
}

export async function getPrimaryVariant(productId: string) {
  return prisma.variant.findFirst({
    where: { productId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function decrementVariantStock(variantId: string, qty: number) {
  await prisma.variant.update({
    where: { id: variantId },
    data: { stock: { decrement: qty } },
  });
}
