import { kv } from "@vercel/kv";

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
  const value = await kv.get<T>(key);
  if (value === null || value === undefined) return fallback;
  return value;
}

export async function kvSetJson<T>(key: string, value: T): Promise<void> {
  await kv.set(key, value);
}
