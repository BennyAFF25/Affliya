import React from 'react';
import Link from 'next/link';
import { StepCard } from '../../../components/ui';
import ApplicationSection from './ApplicationSection';

const steps = [
  ['01', 'Apply', 'Tell us about your work and your business-owner audience. We review every application.'],
  ['02', 'Get approved', 'Receive your personal referral link and sign-in instructions.'],
  ['03', 'Share your link', 'Introduce business owners to Nettmark using your personal link.'],
  ['04', 'Earn', 'Earn on eligible subscription revenue for their first 3 paid months.'],
];
const questions = [
  ['When are commissions paid?', 'Eligible payments enter a 14-day refund hold. Commissions and manual payouts are then reviewed and approved by Nettmark; payouts are not automatic.'],
  ['Which businesses are eligible?', 'Businesses that sign up and pay for a Nettmark plan at nettmark.com through your link, including those that connect their Shopify store from inside Nettmark. Businesses that install Nettmark from the Shopify App Store and pay through Shopify are not eligible, so always send businesses to your link on nettmark.com.'],
  ['Does the free trial count?', 'No. Free trials and failed payments earn nothing. You earn only when an eligible subscription payment is collected. The first three successful paid monthly periods are eligible.'],
  ['How are commissions calculated?', 'GST, discounts and non-eligible fees are excluded from the commission basis. Refunds reduce commission.'],
  ['Do I need to join the affiliate marketplace?', 'No. Growth Partners refer businesses. You can choose to join the affiliate marketplace separately.'],
  ['How long does a referral last?', 'The default referral window is 60 days from the first eligible click. Once a new business is attributed, its referral stays attached through the trial and subscription.'],
  ['Does it cost anything to join?', 'No. Applying and joining the programme are free.'],
];
export default function ApplyPage() {
  return (
    <main>
      <section className="gp-hero">
        <span className="gp-eyebrow">Applications open · selected partners</span>
        <h1>Know the right businesses?<br /><span className="gp-accent">Help them grow.</span></h1>
        <p>Introduce business owners to Nettmark and earn when eligible referred businesses subscribe.</p>
        <a className="gp-button" href="#application">Apply to become a Growth Partner →</a>
        <p className="mt-4 text-sm">Already approved? <Link className="gp-link" href="/growth-partners/login">Sign in</Link></p>
      </section>
      <section className="gp-card border-[#00C2CB]/30">
        <span className="gp-eyebrow">Your referral reward</span>
        <h2 className="mt-3"><span className="gp-accent">50%</span> of eligible subscription revenue, excluding GST</h2>
        <p>For each referred business’s first 3 paid months. Admin-approved payouts follow a 14-day hold; Nettmark reviews and approves payouts manually.</p>
        <p className="mt-3 text-sm">Commission is based on eligible payments actually collected, after discounts and excluding GST, refunds and other fees. Only Nettmark plans paid at nettmark.com count; Shopify App Store installs billed through Shopify are not eligible.</p>
      </section>
      <section className="gp-section">
        <h2>How it works</h2>
        <div className="gp-grid">
          {steps.map(([number, title, description]) => <StepCard key={number} className="rounded-3xl border-white/10 bg-[#151718] text-white" eyebrow={number} title={title} description={description} />)}
        </div>
      </section>
      <section className="gp-card">
        <span className="gp-eyebrow">For people business owners trust</span>
        <h2 className="mt-3">Who it suits</h2>
        <p>Creators, educators, media buyers, agencies, consultants, accountants and advisors: if you have a relevant business-owner audience or professional network, we would like to hear from you. Applications are selected for fit, relevance and credibility.</p>
        <p className="mt-3">Nettmark brings affiliate promotion and paid advertising together. Your role is to introduce businesses that could benefit.</p>
      </section>
      <div className="mb-6"><ApplicationSection id="application" /></div>
      <section className="gp-section">
        <h2>Frequently asked questions</h2>
        {questions.map(([question, answer]) => <details key={question} className="gp-card">
          <summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB]">{question}</summary>
          <p className="mt-3">{answer}</p>
        </details>)}
      </section>
    </main>
  );
}
