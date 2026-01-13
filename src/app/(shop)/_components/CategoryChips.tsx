"use client";

import { cn } from "@/lib/utils";

type CategoryChipsProps = {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
};

export function CategoryChips({ categories, value, onChange }: CategoryChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {categories.map((category) => {
        const active = value === category;
        return (
          <button
            key={category}
            onClick={() => onChange(category)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"
            )}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
