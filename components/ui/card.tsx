import * as React from "react";
import { cn } from "./utils";

type CardVariant = "default" | "elevated" | "glass" | "dark";

const variants: Record<CardVariant, string> = {
  default: "border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm",
  elevated:
    "border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[0_18px_55px_rgba(15,23,42,0.09)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.36)]",
  glass:
    "border-white/10 bg-white/[0.04] text-[var(--foreground)] shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-xl",
  dark: "border-white/10 bg-[#101010] text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
};

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  interactive?: boolean;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border",
        variants[variant],
        interactive && "transition duration-200 hover:-translate-y-0.5 hover:border-[#00C2CB]/60 hover:shadow-[0_20px_60px_rgba(0,194,203,0.14)]",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-[var(--foreground)]", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-[var(--muted-foreground)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 p-5 pt-3", className)} {...props} />;
}
