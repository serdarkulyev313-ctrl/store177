import { cn } from "@/lib/utils";

export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm font-semibold text-slate-500", className)} {...props} />;
}
