import { ReactNode, useState } from 'react';

interface InboxCardProps {
  title: string;
  subtitle?: string;
  body?: string;
  meta?: ReactNode;
  statusBadge?: string;
  timestamp?: string;
  icon?: ReactNode;
  accent?: 'teal' | 'amber' | 'red' | 'neutral';
  selected?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
  swipeActions?: ReactNode;
}

const accentMap: Record<NonNullable<InboxCardProps['accent']>, string> = {
  teal: 'border-l-[#00C2CB] text-white',
  amber: 'border-l-[#FACC15] text-white',
  red: 'border-l-[#f472b6] text-white',
  neutral: 'border-l-white/10 text-white',
};

export function InboxCard({
  title,
  subtitle,
  body,
  meta,
  statusBadge,
  timestamp,
  icon,
  accent = 'teal',
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
        <div className={`absolute inset-y-0 right-0 flex items-center gap-2 pr-4 transition-opacity ${isSwiped ? 'opacity-100' : 'opacity-0 pointer-events-none'} sm:hidden`}>
          {swipeActions}
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect?.();
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`group relative rounded-2xl border border-white/10 ${accentMap[accent]} bg-[#101010]/80 backdrop-blur px-5 py-4 transition-all cursor-pointer hover:border-[#00C2CB]/40 hover:bg-[#0f0f0f] ${
          selected ? 'ring-2 ring-[#00C2CB] ring-offset-2 ring-offset-black' : ''
        } ${isSwiped ? 'translate-x-[-64px]' : ''}`}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1 text-[#00C2CB]">{icon}</div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white truncate">{title}</p>
              {statusBadge && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/70">
                  {statusBadge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-white/60 truncate">{subtitle}</p>}
            {body && <p className="text-sm text-white/70 line-clamp-2">{body}</p>}
            {timestamp && <p className="text-[11px] text-white/40">{timestamp}</p>}
            {meta && <div className="pt-1 text-xs text-white/60">{meta}</div>}
          </div>
        </div>
        {actions && (
          <div className="mt-4 hidden flex-wrap gap-2 sm:flex">{actions}</div>
        )}
      </div>
    </div>
  );
}
