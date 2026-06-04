import React, { ReactNode } from "react";
import { Badge, Button } from "@/../components/ui";

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
          <Button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            variant={isActive ? "primary" : "secondary"}
            size="sm"
            className="rounded-full"
          >
            {tab.icon && (
              <span className="text-base sm:text-lg">{tab.icon}</span>
            )}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <Badge
                variant={isActive ? "outline" : "muted"}
                className={`min-w-[1.5rem] justify-center px-2 py-0.5 tracking-normal ${
                  isActive ? "border-black/10 bg-black/10 text-[#041012]" : ""
                }`}
              >
                {tab.count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
