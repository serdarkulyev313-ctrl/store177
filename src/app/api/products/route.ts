export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readProducts, viewProductForCatalog } from "@/lib/productsStore";

export async function GET() {
  const products = readProducts().map(viewProductForCatalog);
  return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
}
