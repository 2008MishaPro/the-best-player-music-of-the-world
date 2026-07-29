import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn.ts";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("badge", className)} {...props} />;
}
