import { ReactNode } from 'react';

export interface InboxTab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface InboxTabsProps {
  tabs: InboxTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function InboxTabs({ tabs, activeTab, onTabChange }: InboxTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-all border ${
              isActive
                ? 'bg-[#00C2CB] text-black border-[#00C2CB] shadow-[0_8px_20px_rgba(0,194,203,0.35)]'
                : 'bg-[#121212] text-white/70 border-white/5 hover:border-white/20'
            }`}
          >
            {tab.icon && <span className="text-base sm:text-lg">{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`inline-flex min-w-[1.5rem] justify-center rounded-full px-2 py-0.5 text-[11px] ${
                  isActive ? 'bg-black/20 text-black' : 'bg-white/5 text-white/70'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
