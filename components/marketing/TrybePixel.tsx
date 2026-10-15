'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { loadTrybePixel } from '../../utils/marketing/trybePixel';

export default function TrybePixel() {
  const pathname = usePathname();
  useEffect(() => {
    loadTrybePixel(pathname, document, window);
  }, [pathname]);
  return null;
}
