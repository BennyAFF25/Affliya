import * as React from "react";
import { cn } from "./utils";

type ModeOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  badge?: React.ReactNode;
};

export type ModeSelectorProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  options: ModeOption[];
  onChange: (value: string) => void;
};

export function ModeSelector({ value, options, onChange, className, ...props }: ModeSelectorProps) {
  return (
    <div
      className={cn("grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 sm:grid-cols-2", className)}
      {...props}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => {
              if (!option.disabled) onChange(option.value);
            }}
            className={cn(
              "rounded-xl border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-[#00C2CB]/70 bg-[#00C2CB]/12 shadow-[0_14px_34px_rgba(0,194,203,0.12)]"
                : "border-transparent bg-transparent hover:border-[var(--border)] hover:bg-[var(--secondary)]/60",
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className={cn("block text-sm font-semibold", active ? "text-[#7ff5fb]" : "text-[var(--foreground)]")}>{option.label}</span>
                {option.description && (
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{option.description}</span>
                )}
              </span>
              {option.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
