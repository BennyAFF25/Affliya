import React, { ReactNode, useState } from "react";
import { Badge, Card } from "@/../components/ui";

interface InboxCardProps {
  title: string;
  subtitle?: string;
  body?: string;
  meta?: ReactNode;
  statusBadge?: string;
  timestamp?: string;
  icon?: ReactNode;
  accent?: "teal" | "amber" | "red" | "neutral";
  selected?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
  swipeActions?: ReactNode;
}

const accentMap: Record<NonNullable<InboxCardProps["accent"]>, string> = {
  teal: "border-l-[var(--primary)] text-[var(--foreground)]",
  amber: "border-l-[#FACC15] text-[var(--foreground)]",
  red: "border-l-[#f472b6] text-[var(--foreground)]",
  neutral: "border-l-[var(--border)] text-[var(--foreground)]",
};

export function InboxCard({
  title,
  subtitle,
  body,
  meta,
  statusBadge,
  timestamp,
  icon,
  accent = "teal",
  selected,
  onSelect,
  actions,
  swipeActions,
}: InboxCardProps) {
  const [isSwiped, setIsSwiped] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (delta < -40) {
      setIsSwiped(true);
    } else if (delta > 40) {
      setIsSwiped(false);
    }
  };

  return (
    <div className="relative">
      {swipeActions && (
        <div
          className={`absolute inset-y-0 right-0 flex items-center gap-2 pr-4 transition-opacity ${isSwiped ? "opacity-100" : "opacity-0 pointer-events-none"} sm:hidden`}
        >
          {swipeActions}
        </div>
      )}
      <Card
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect?.();
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`group relative border-l-4 ${accentMap[accent]} px-4 py-3 transition-all cursor-pointer hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)] ${
          selected
            ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]"
            : ""
        } ${isSwiped ? "translate-x-[-64px]" : ""}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 text-[var(--primary)]">{icon}</div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                {title}
              </p>
              {statusBadge && (
                <Badge variant="muted" className="py-0.5 normal-case tracking-normal">
                  {statusBadge}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-[var(--muted-foreground)] truncate">
                {subtitle}
              </p>
            )}
            {body && (
              <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
                {body}
              </p>
            )}
            {timestamp && (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {timestamp}
              </p>
            )}
            {meta && (
              <div className="pt-1 text-xs text-[var(--muted-foreground)]">
                {meta}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div className="mt-4 hidden flex-wrap gap-2 sm:flex">{actions}</div>
        )}
      </Card>
    </div>
  );
}
