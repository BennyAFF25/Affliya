import * as React from "react";
import { Card } from "./card";
import { cn } from "./utils";

export type ReviewCardProps = React.HTMLAttributes<HTMLDivElement> & {
  header?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
};

export function ReviewCard({ header, title, description, meta, actions, className, children, ...props }: ReviewCardProps) {
  return (
    <Card className={cn("p-4 sm:p-5", className)} variant="elevated" {...props}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {header ? <div className="mb-3 flex flex-wrap items-center gap-2">{header}</div> : null}
          <h3 className="text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">
            {title}
          </h3>
          {description ? (
            <div className="mt-1 line-clamp-3 text-sm leading-6 text-[var(--muted-foreground)]">
              {description}
            </div>
          ) : null}
          {meta ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{meta}</div> : null}
          {children}
        </div>
        {actions ? <div className="w-full lg:w-auto lg:min-w-[190px]">{actions}</div> : null}
      </div>
    </Card>
  );
}

export function ReviewMetaItem({ label, children, className }: React.HTMLAttributes<HTMLDivElement> & { label: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2.5", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-1.5 break-words text-sm font-medium text-[var(--foreground)]">{children}</div>
    </div>
  );
}
