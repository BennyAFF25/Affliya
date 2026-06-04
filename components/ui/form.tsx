/* eslint-disable react/prop-types */
import * as React from "react";
import { cn } from "./utils";

export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

const controlClass =
  "w-full rounded-xl border border-[var(--input)] bg-[var(--input-background)] px-3 py-2.5 text-sm text-[var(--foreground)] shadow-sm transition placeholder:text-[var(--muted-foreground)]/70 focus:border-[#00C2CB] focus:outline-none focus:ring-2 focus:ring-[#00C2CB]/20 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(controlClass, className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlClass, "min-h-24 resize-y", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(controlClass, className)} {...props} />,
);
Select.displayName = "Select";

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-5 text-[var(--muted-foreground)]", className)} {...props} />;
}

export function FieldError({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs font-medium leading-5 text-red-400", className)} {...props} />;
}
