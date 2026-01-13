"use client";

import { useEffect, useMemo, useState } from "react";

import type { CatalogProduct } from "@/lib/storefront";

export function useProducts() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить каталог");
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        setProducts(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch(() => {
        if (!mounted) return;
        setProducts([]);
        setError("Не удалось загрузить каталог. Проверьте подключение.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const productMap = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    for (const product of products) map.set(product.id, product);
    return map;
  }, [products]);

  return { products, productMap, loading, error };
}
