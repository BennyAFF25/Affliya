import Link from "next/link";
import * as React from "react";
import { cn } from "./utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#00C2CB] text-[#041012] shadow-[0_12px_28px_rgba(0,194,203,0.22)] hover:bg-[#00b0b8] focus-visible:ring-[#00C2CB]/40",
  secondary:
    "border border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)] focus-visible:ring-[var(--ring)]/35",
  outline:
    "border border-[#00C2CB]/45 bg-transparent text-[#00C2CB] hover:border-[#00C2CB] hover:bg-[#00C2CB]/10 focus-visible:ring-[#00C2CB]/35",
  ghost:
    "bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] focus-visible:ring-[var(--ring)]/35",
  danger:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:brightness-110 focus-visible:ring-[var(--destructive)]/35",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-11 gap-2.5 rounded-xl px-5 text-sm",
  icon: "h-10 w-10 rounded-xl p-0",
};

const baseClass =
  "inline-flex shrink-0 items-center justify-center font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50";

type NativeButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type LinkButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export type ButtonProps = NativeButtonProps | LinkButtonProps;

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(baseClass, variants[variant], sizes[size], className);
}

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const classes = buttonClasses({ variant, size, className });

    if ("href" in props && props.href) {
      const { href, ...linkProps } = props;
      return <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={classes} {...linkProps} />;
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...(props as NativeButtonProps)}
      />
    );
  },
);

Button.displayName = "Button";
