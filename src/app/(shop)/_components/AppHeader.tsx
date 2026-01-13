"use client";

import Link from "next/link";
import { ShoppingBag, Sparkles } from "lucide-react";
import { useCart } from "../_state/cart";

export function AppHeader() {
  const { count } = useCart();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Sparkles size={18} />
        </div>
        <div>
          <div className="text-base font-semibold text-slate-900">Store 177</div>
          <div className="text-xs text-slate-500">Маркет техники</div>
        </div>
      </div>
      <Link
        href="/cart"
        className="inline-flex h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
      >
        <ShoppingBag size={16} />
        <span>Корзина</span>
        {count > 0 ? (
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">{count}</span>
        ) : null}
      </Link>
    </div>
  );
}
