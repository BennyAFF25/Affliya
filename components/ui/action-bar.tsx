import * as React from "react";
import { cn } from "./utils";

export type ActionBarProps = React.HTMLAttributes<HTMLDivElement>;

export function ActionBar({ className, ...props }: ActionBarProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end",
        className,
      )}
      {...props}
    />
  );
}
