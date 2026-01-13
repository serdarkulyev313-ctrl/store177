"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDebounce } from "./_hooks/useDebounce";
import { useProducts } from "./_hooks/useProducts";
import { AppHeader } from "./_components/AppHeader";
import { CategoryChips } from "./_components/CategoryChips";
import { PageContainer } from "./_components/PageContainer";
import { ProductCard } from "./_components/ProductCard";
import { SearchBar } from "./_components/SearchBar";
import { SegmentedControl } from "./_components/SegmentedControl";
import { SectionTitle } from "./_components/SectionTitle";
import { SkeletonCard } from "./_components/SkeletonCard";
import type { CatalogProduct } from "@/lib/storefront";

const segments = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "used", label: "Б/У" },
];

const sortOptions = [
  { value: "popular", label: "Рекомендуем" },
  { value: "price-asc", label: "Цена ↑" },
  { value: "price-desc", label: "Цена ↓" },
  { value: "title", label: "Название" },
  { value: "stock", label: "Наличие" },
];

function applySort(list: CatalogProduct[], sort: string) {
  const next = [...list];
  switch (sort) {
    case "price-asc":
      return next.sort((a, b) => a.price - b.price);
    case "price-desc":
      return next.sort((a, b) => b.price - a.price);
    case "title":
      return next.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    case "stock":
      return next.sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
    default:
      return next;
  }
}

export default function MarketPage() {
  const { products, loading, error } = useProducts();
  const [segment, setSegment] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Все");
  const [sort, setSort] = useState(sortOptions[0].value);

  const debouncedSearch = useDebounce(search, 300);

  const categories = useMemo(() => {
    const brands = Array.from(new Set(products.map((product) => product.brand).filter(Boolean)));
    return ["Все", ...brands];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;

    if (segment !== "all") {
      list = list.filter((product) => product.condition === segment);
    }

    if (category !== "Все") {
      list = list.filter((product) => product.brand === category);
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.trim().toLowerCase();
      list = list.filter(
        (product) =>
          product.title.toLowerCase().includes(query) ||
          product.brand.toLowerCase().includes(query) ||
          product.condition === query
      );
    }

    return applySort(list, sort);
  }, [products, segment, category, debouncedSearch, sort]);

  return (
    <PageContainer className="space-y-5">
      <AppHeader />

      <div className="space-y-3">
        <SegmentedControl segments={segments} value={segment} onChange={setSegment} />
        <SearchBar value={search} onChange={setSearch} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>Категории</SectionTitle>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <SlidersHorizontal className="h-4 w-4" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <CategoryChips categories={categories} value={category} onChange={setCategory} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">Специально для тебя</div>
            <div className="text-xs text-slate-500">{filtered.length} товаров</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCategory("Все")}> 
            Сбросить
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : error ? (
          <Card className="p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">Что-то пошло не так</div>
            <div className="mt-2">{error}</div>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => location.reload()}>
              Обновить
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">Ничего не нашли</div>
            <div className="mt-2">Попробуйте изменить фильтры или поиск.</div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
