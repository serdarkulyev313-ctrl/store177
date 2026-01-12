"use client";

import { Heart, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import type { CatalogProduct } from "@/lib/storefront";
import { cn } from "@/lib/utils";

import { useCart } from "../_state/cart";
import { useFavorites } from "../_state/favorites";
import { useToast } from "../_state/toast";

type ProductCardProps = {
  product: CatalogProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const { show } = useToast();
  const favorite = isFavorite(product.id);

  const stockLabel = product.stock > 0 ? "В наличии" : "Нет в наличии";

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/3] w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-3">
        <div className="flex h-full items-end justify-between">
          <div className="rounded-xl bg-white/10 px-2 py-1 text-xs font-semibold text-white">
            {product.brand || "Без бренда"}
          </div>
        </div>
        <button
          onClick={() => toggle(product.id)}
          className={cn(
            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm",
            favorite && "text-rose-500"
          )}
          aria-label="Добавить в избранное"
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <Badge className={product.condition === "new" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
            {product.condition === "new" ? "Новый" : "Б/У"}
          </Badge>
          <span className="text-xs text-slate-400">{stockLabel}</span>
        </div>
        <div className="line-clamp-2 text-sm font-semibold text-slate-900">
          {product.title}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">{formatMoney(product.price)}</div>
            {product.oldPrice ? (
              <div className="text-xs text-slate-400 line-through">{formatMoney(product.oldPrice)}</div>
            ) : null}
          </div>
          <button
            onClick={() => {
              if (product.stock <= 0) return;
              addItem(product.id, product.stock);
              show(`Добавили «${product.title}» в корзину`);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40"
            disabled={product.stock <= 0}
            aria-label="Добавить в корзину"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
