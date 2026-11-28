import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import './growth-partners.css';

export const metadata: Metadata = { title: 'Growth Partners | Nettmark', robots: { index: false, follow: false } };

export default function GrowthPartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="growth-partners">
      <div className="gp-shell">
        <header className="gp-header">
          <Link href="/" aria-label="Nettmark home" className="gp-brand">nettmark<span>.</span></Link>
          <span className="gp-eyebrow">Growth Partner Programme</span>
        </header>
        {children}
        <footer className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-sm text-slate-400">
          <a href="mailto:support@nettmark.com">support@nettmark.com</a>
          <Link href="/legal/privacy">Privacy policy</Link>
        </footer>
      </div>
    </div>
  );
}
