'use client';
import { useEffect } from 'react';

export function Toast({
  open, title, body, actionLabel = 'Check inbox', onAction, onClose
}: {
  open: boolean;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose?.(), 6000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[1000] max-w-sm w-[360px]">
      <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1f1f1f]">
          <div className="text-sm font-semibold text-white">{title}</div>
          {body ? <div className="text-xs text-gray-400 mt-1">{body}</div> : null}
        </div>
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            onClick={onAction}
            className="px-3 py-1.5 rounded-md bg-[#00C2CB] hover:bg-[#00b0b8] text-black text-sm font-semibold"
          >
            {actionLabel}
          </button>
          <button
            onClick={onClose}
            className="ml-auto text-xs text-gray-400 hover:text-gray-200"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}