import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/kv';

export async function GET() {
  const products = await getProducts();
  return NextResponse.json(products);
}
