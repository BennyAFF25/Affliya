'use client';

import type { ReactNode } from 'react';

export function ShopGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}
