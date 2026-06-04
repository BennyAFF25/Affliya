import * as React from "react";
import { cn } from "./utils";

export type DialogShellProps = React.HTMLAttributes<HTMLDivElement> & {
  onClose?: () => void;
};

export function DialogShell({ className, children, onClose, ...props }: DialogShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-[28px] border border-[#151b1f] bg-[#05080a] shadow-[0_20px_60px_rgba(0,0,0,0.75)]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}
