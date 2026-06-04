import * as React from "react";
import { cn } from "./utils";

type StatTone = "default" | "primary" | "success" | "warning" | "danger" | "muted";

const tones: Record<StatTone, string> = {
  default: "border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)]",
  primary: "border-[#00C2CB]/35 bg-[#00C2CB]/12 text-[#00C2CB]",
  success: "border-emerald-400/30 bg-emerald-500/12 text-emerald-300",
  warning: "border-amber-400/35 bg-amber-500/12 text-amber-300",
  danger: "border-red-400/35 bg-red-500/12 text-red-300",
  muted: "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
};

export type StatCardProps = React.HTMLAttributes<HTMLDivElement> & {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  helper?: React.ReactNode;
  tone?: StatTone;
  interactive?: boolean;
};

export function StatCard({
  label,
  value,
  icon,
  helper,
  tone = "default",
  interactive = false,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--foreground)] shadow-sm",
        interactive && "cursor-pointer transition hover:-translate-y-0.5 hover:border-[#00C2CB]/50 hover:shadow-[0_18px_50px_rgba(0,194,203,0.12)]",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {label}
          </p>
          <div className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
            {value}
          </div>
        </div>
        {icon ? (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", tones[tone])}>
            {icon}
          </div>
        ) : null}
      </div>
      {helper ? <div className="mt-3 text-xs text-[var(--muted-foreground)]">{helper}</div> : null}
    </div>
  );
}
