import React from 'react';
import Link from 'next/link';
import { BadgeCheck, Mail, LayoutDashboard } from 'lucide-react';
import ApplicationForm from './ApplicationForm';

// Shared application block for /partner-program and /growth-partners/apply.
// Only state implemented behaviour: no review timeframe is promised.
const next = [
  { icon: <BadgeCheck size={18} aria-hidden="true" />, title: 'We review your application', text: 'Every application is reviewed by the Nettmark team for fit and relevance.' },
  { icon: <Mail size={18} aria-hidden="true" />, title: 'Approval by email', text: 'If approved, you get an email with your referral link. Sign in any time with a secure one-time email link, no password needed.' },
  { icon: <LayoutDashboard size={18} aria-hidden="true" />, title: 'Your partner dashboard', text: 'Track referrals and commissions, copy your link and use the starter kit of ready-made messages.' },
];

export default function ApplicationSection({ id = 'apply', headingLevel = 'h2' }: { id?: string; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return <section id={id} className="growth-partners gp-embedded gp-apply scroll-mt-24" aria-labelledby={`${id}-title`}>
    <div className="gp-apply-grid">
      <aside className="gp-apply-aside">
        <span className="gp-eyebrow gp-eyebrow-accent">Apply now · free</span>
        <Heading id={`${id}-title`} className="gp-apply-title">Become a Growth Partner</Heading>
        <p className="gp-apply-intro">It takes about a minute. Tell us who you are and who you know, and we&apos;ll take it from there.</p>
        <div className="gp-reward" aria-label="Partner reward">
          <div><strong>50%</strong><span>of eligible subscription revenue, ex GST</span></div>
          <div><strong>3 months</strong><span>first 3 paid months of each referred business</span></div>
        </div>
        <h3 className="gp-next-title">What happens next</h3>
        <ol className="gp-next">
          {next.map((item, index) => <li key={item.title}><span className="gp-next-icon">{item.icon}<span className="sr-only">Step {index + 1}</span></span><div><strong>{item.title}</strong><p>{item.text}</p></div></li>)}
        </ol>
        <p className="gp-apply-small">Commissions are reviewed after a 14-day hold and paid manually by Nettmark. Only plans paid at nettmark.com count, not Shopify App Store installs.</p>
      </aside>
      <div className="gp-apply-card">
        <div className="gp-apply-card-head">
          <h3>Your details</h3>
          <p>All fields are required.</p>
        </div>
        <ApplicationForm />
        <p className="gp-apply-legal">By applying, you agree that we can contact you about your application. <Link className="gp-link" href="/legal/privacy">Privacy policy</Link> · Already approved? <Link className="gp-link" href="/growth-partners/login">Sign in</Link></p>
      </div>
    </div>
  </section>;
}
