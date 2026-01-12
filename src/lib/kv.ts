// src/lib/kv.ts
import { kv } from "@vercel/kv";

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
  const v = await kv.get<T>(key);
  return (v ?? fallback) as T;
}

export async function kvSetJson<T>(key: string, value: T): Promise<void> {
  await kv.set(key, value);
}
