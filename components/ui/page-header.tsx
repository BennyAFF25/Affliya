import * as React from "react";
import { cn } from "./utils";
import { Badge } from "./badge";

export type PageHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)} {...props}>
      <div className="max-w-3xl space-y-2">
        {eyebrow ? <Badge variant="primary">{eyebrow}</Badge> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">{title}</h1>
        {description ? <p className="text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
