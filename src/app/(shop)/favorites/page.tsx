"use client";

import { HeartOff } from "lucide-react";

import { Card } from "@/components/ui/card";
import { AppHeader } from "../_components/AppHeader";
import { PageContainer } from "../_components/PageContainer";
import { ProductCard } from "../_components/ProductCard";
import { SectionTitle } from "../_components/SectionTitle";
import { SkeletonCard } from "../_components/SkeletonCard";
import { useProducts } from "../_hooks/useProducts";
import { useFavorites } from "../_state/favorites";

export default function FavoritesPage() {
  const { products, loading, error } = useProducts();
  const { ids } = useFavorites();

  const favorites = products.filter((product) => ids.includes(product.id));

  return (
    <PageContainer className="space-y-5">
      <AppHeader />

      <div className="space-y-3">
        <SectionTitle>Избранное</SectionTitle>
        <div className="text-base font-semibold text-slate-900">Сохранённые товары</div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      ) : error ? (
        <Card className="p-4 text-sm text-slate-600">
          <div className="font-semibold text-slate-900">Не удалось загрузить избранное</div>
          <div className="mt-2">{error}</div>
        </Card>
      ) : favorites.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center text-sm text-slate-600">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <HeartOff className="h-5 w-5 text-slate-400" />
          </div>
          <div className="font-semibold text-slate-900">Пока пусто</div>
          <div>Сохраняйте понравившиеся товары сердцем.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {favorites.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
