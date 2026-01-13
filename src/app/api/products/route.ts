export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listProductsForCatalog } from "@/lib/db/products";

export async function GET() {
  const products = await listProductsForCatalog();
  return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
}
