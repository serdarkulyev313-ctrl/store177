"use client";

import { createContext, useContext, useMemo } from "react";

import type { CartItem } from "@/lib/storefront";
import { useLocalStorageState } from "../_hooks/useLocalStorageState";

const CART_KEY = "store177_cart";

type CartContextValue = {
  items: CartItem[];
  count: number;
  addItem: (productId: string, maxQty: number) => void;
  setQty: (productId: string, qty: number, maxQty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { state: items, setState: setItems } = useLocalStorageState<CartItem[]>(CART_KEY, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0);

    return {
      items,
      count,
      addItem: (productId, maxQty) => {
        setItems((prev) => {
          const existing = prev.find((item) => item.productId === productId);
          const currentQty = existing?.qty ?? 0;
          const nextQty = Math.min(currentQty + 1, maxQty);

          if (existing) {
            return prev.map((item) => (item.productId === productId ? { ...item, qty: nextQty } : item));
          }
          return [...prev, { productId, qty: Math.max(1, Math.min(1, maxQty)) }];
        });
      },
      setQty: (productId, qty, maxQty) => {
        const safeQty = Math.max(0, Math.min(qty, maxQty));
        setItems((prev) => {
          if (safeQty === 0) return prev.filter((item) => item.productId !== productId);
          return prev.map((item) => (item.productId === productId ? { ...item, qty: safeQty } : item));
        });
      },
      removeItem: (productId) => {
        setItems((prev) => prev.filter((item) => item.productId !== productId));
      },
      clear: () => setItems([]),
    };
  }, [items, setItems]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
