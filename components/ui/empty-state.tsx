import * as React from "react";
import { cn } from "./utils";
import { Card } from "./card";

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

export function EmptyState({ icon, title, description, actions, className, ...props }: EmptyStateProps) {
  return (
    <Card className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)} {...props}>
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 text-[#00C2CB]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">{description}</p> : null}
      {actions ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </Card>
  );
}
