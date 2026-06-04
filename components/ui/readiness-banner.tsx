import * as React from "react";
import { cn } from "./utils";

type ReadinessTone = "info" | "warning" | "danger" | "success";

const toneClasses: Record<ReadinessTone, string> = {
  info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  danger: "border-red-500/30 bg-red-500/10 text-red-100",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
};

export type ReadinessBannerProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: ReadinessTone;
  title: React.ReactNode;
  children?: React.ReactNode;
};

export function ReadinessBanner({ tone = "info", title, children, className, ...props }: ReadinessBannerProps) {
  return (
    <div className={cn("rounded-2xl border p-4 text-sm shadow-[0_14px_34px_rgba(0,0,0,0.12)]", toneClasses[tone], className)} {...props}>
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1 leading-6 opacity-85">{children}</div>}
    </div>
  );
}
