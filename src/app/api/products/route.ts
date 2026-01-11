import { NextResponse } from "next/server";
import { kvGetJson } from "@/lib/kv";

const KEY_PRODUCTS = "products";

export async function GET() {
  const products = (await kvGetJson<any[]>(KEY_PRODUCTS)) ?? [];
  return NextResponse.json({ ok: true, products });
}
