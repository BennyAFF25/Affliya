import { ReactNode } from 'react';

interface DashboardCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: string;
}

const baseClasses =
  'relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#101010] to-[#070707] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)]';

const interactiveClasses = 'transition-transform duration-300 ease-out hover:scale-[1.01]';

export default function DashboardCard({
  children,
  className = '',
  interactive = true,
  padding = 'p-4',
}: DashboardCardProps) {
  return (
    <div
      className={`${baseClasses} ${interactive ? interactiveClasses : ''} ${padding} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
