import { ReactNode } from "react";

interface DashboardCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: string;
}

const baseClasses =
  "relative rounded-2xl bg-[#111317]/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

const interactiveClasses =
  "transition-transform duration-300 ease-out hover:scale-[1.01]";

export default function DashboardCard({
  children,
  className = "",
  interactive = true,
  padding = "p-4",
}: DashboardCardProps) {
  return (
    <div
      className={`${baseClasses} ${interactive ? interactiveClasses : ""} ${padding} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
