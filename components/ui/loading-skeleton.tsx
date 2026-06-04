import * as React from "react";
import { cn } from "./utils";

export type LoadingSkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  lines?: number;
};

export function LoadingSkeleton({ lines = 3, className, ...props }: LoadingSkeletonProps) {
  return (
    <div className={cn("rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4", className)} {...props}>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-3 animate-pulse rounded-full bg-[var(--muted)]",
              index === 0 ? "w-3/4" : index === lines - 1 ? "w-1/2" : "w-full",
            )}
          />
        ))}
      </div>
    </div>
  );
}
