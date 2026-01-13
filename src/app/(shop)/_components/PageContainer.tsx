import { cn } from "@/lib/utils";

export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-md px-4 pb-24 pt-4", className)} {...props} />
  );
}
