import * as React from "react";
import { cn } from "./utils";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "muted" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)]",
  primary: "border-[#00C2CB]/35 bg-[#00C2CB]/12 text-[#00C2CB]",
  success: "border-emerald-400/30 bg-emerald-500/12 text-emerald-300",
  warning: "border-amber-400/35 bg-amber-500/12 text-amber-300",
  danger: "border-red-400/35 bg-red-500/12 text-red-300",
  muted: "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
  outline: "border-[var(--border)] bg-transparent text-[var(--foreground)]",
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
