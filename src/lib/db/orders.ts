import { prisma } from "@/lib/db/client";
import { getPrimaryVariant, decrementVariantStock } from "@/lib/db/products";

export type OrderInput = {
  tgUserId: number | null;
  customerName: string;
  phone: string;
  method: "pickup" | "courier";
  address?: string | null;
  comment?: string | null;
  items: { productId: string; qty: number }[];
};

export async function createOrder(input: OrderInput) {
  const itemsData: {
    productId: string;
    variantId: string | null;
    titleSnapshot: string;
    priceSnapshot: number;
    qty: number;
  }[] = [];

  let total = 0;

  for (const item of input.items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });
    if (!product) throw new Error(`product not found: ${item.productId}`);

    const variant = await getPrimaryVariant(product.id);
    if (!variant) throw new Error(`variant not found: ${product.title}`);

    if (variant.stock < item.qty) {
      throw new Error(`not enough stock: ${product.title}`);
    }

    itemsData.push({
      productId: product.id,
      variantId: variant.id,
      titleSnapshot: product.title,
      priceSnapshot: variant.priceValue,
      qty: item.qty,
    });

    total += variant.priceValue * item.qty;
  }

  const order = await prisma.order.create({
    data: {
      tgUserId: input.tgUserId ?? null,
      customerName: input.customerName,
      phone: input.phone,
      method: input.method,
      address: input.method === "courier" ? input.address ?? null : null,
      comment: input.comment ?? null,
      total,
      orderStatus: "created",
      paymentStatus: "unpaid",
      items: {
        create: itemsData.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          titleSnapshot: item.titleSnapshot,
          priceSnapshot: item.priceSnapshot,
          qty: item.qty,
        })),
      },
    },
    include: { items: true },
  });

  for (const item of itemsData) {
    if (item.variantId) {
      await decrementVariantStock(item.variantId, item.qty);
    }
  }

  return order;
}

export async function listOrders() {
  return prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateOrderStatus(id: string, patch: { orderStatus?: string; paymentStatus?: string }) {
  return prisma.order.update({
    where: { id },
    data: {
      orderStatus: patch.orderStatus,
      paymentStatus: patch.paymentStatus,
    },
  });
}
