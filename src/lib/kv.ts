// src/lib/kv.ts
import { kv } from "@vercel/kv";

export function hasKV() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Безопасно читаем из KV. Если ключа нет — вернёт fallback.
 */
export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
  if (!hasKV()) return fallback;
  const v = await kv.get<T>(key);
  return (v ?? fallback) as T;
}

/**
 * Безопасно пишем в KV.
 */
export async function kvSetJson<T>(key: string, value: T): Promise<void> {
  if (!hasKV()) {
    throw new Error("KV is not configured (missing KV_REST_API_URL / KV_REST_API_TOKEN)");
  }
  await kv.set(key, value as any);
}
