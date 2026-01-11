import { kv } from '@vercel/kv';

export async function getProducts() {
  const products = await kv.get('products');
  return Array.isArray(products) ? products : [];
}

export async function saveProducts(products: any[]) {
  await kv.set('products', products);
}
