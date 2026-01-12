"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutGrid, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Маркет", icon: LayoutGrid },
  { href: "/favorites", label: "Избранное", icon: Heart },
  { href: "/profile", label: "Профиль", icon: UserCircle },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-md border-t border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 text-xs font-medium",
                active ? "text-slate-900" : "text-slate-400"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl",
                  active && "bg-slate-900 text-white"
                )}
              >
                <Icon size={18} />
              </div>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
