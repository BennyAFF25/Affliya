import * as React from "react";
import { cn } from "./utils";

export type StepCardProps = React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

export function StepCard({ eyebrow, title, description, actions, className, children, ...props }: StepCardProps) {
  return (
    <section className={cn("rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[0_18px_55px_rgba(0,0,0,0.18)]", className)} {...props}>
      {(eyebrow || title || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{eyebrow}</div>}
            {title && <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
