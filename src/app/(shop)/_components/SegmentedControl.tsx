"use client";

import { cn } from "@/lib/utils";

type Segment = { value: string; label: string };

type SegmentedControlProps = {
  segments: Segment[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedControl({ segments, value, onChange }: SegmentedControlProps) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
      {segments.map((segment) => {
        const active = value === segment.value;
        return (
          <button
            key={segment.value}
            onClick={() => onChange(segment.value)}
            className={cn(
              "rounded-xl py-2 text-sm font-medium transition-colors",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
