import * as React from "react";
import { cn } from "./utils";

export type PreviewPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
};

export function PreviewPanel({ title, description, className, children, ...props }: PreviewPanelProps) {
  return (
    <aside className={cn("rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.16)]", className)} {...props}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>}
          {description && <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>}
        </div>
      )}
      {children}
    </aside>
  );
}
