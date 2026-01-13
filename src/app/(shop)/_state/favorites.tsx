"use client";

import { createContext, useContext, useMemo } from "react";

import { useLocalStorageState } from "../_hooks/useLocalStorageState";

const FAVORITES_KEY = "store177_favorites";

type FavoritesContextValue = {
  ids: string[];
  toggle: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { state: ids, setState: setIds } = useLocalStorageState<string[]>(FAVORITES_KEY, []);

  const value = useMemo<FavoritesContextValue>(() => {
    return {
      ids,
      toggle: (productId) => {
        setIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
      },
      isFavorite: (productId) => ids.includes(productId),
    };
  }, [ids, setIds]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
