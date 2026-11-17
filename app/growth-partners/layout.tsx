import type { Metadata } from 'next';
import Link from 'next/link';
import './growth-partners.css';
export const metadata: Metadata = { title: 'Growth Partners | Nettmark', robots: { index: false, follow: false } };
export default function GrowthPartnersLayout({ children }: { children: React.ReactNode }) {
  return <div className="growth-partners"><div className="gp-shell"><header className="gp-header"><Link href="/" aria-label="Nettmark home" className="gp-brand">nettmark<span>.</span></Link><span className="gp-eyebrow">Growth Partner Programme</span></header>{children}</div></div>;
}
