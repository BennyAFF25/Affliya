import React from 'react';
import Link from 'next/link';
import ApplicationForm from './ApplicationForm';
export default function ApplyPage() {
  return <main>
    <section className="gp-hero"><span className="gp-eyebrow">Applications open · selected partners</span><h1>Know the right businesses?<br /><span className="gp-accent">Help them grow.</span></h1><p>Introduce business owners to Nettmark. Earn 50% of their eligible subscription revenue for their first three paid months.</p><a className="gp-button" href="#application">Apply to become a Growth Partner →</a><p className="mt-4 text-sm">Already approved? <Link className="gp-link" href="/growth-partners/login">Sign in</Link></p></section>
    <section className="gp-card"><span className="gp-eyebrow">A different kind of distribution</span><h2 className="mt-3">Affiliate marketing. Business-funded paid advertising.</h2><p>Nettmark brings affiliate promotion and paid advertising together. Businesses can connect with people who promote their offers, while business-funded advertising helps put those offers in front of more customers. Your role is simple: introduce businesses that could benefit.</p></section>
    <section className="gp-section"><h2>Three steps to start referring</h2><div className="gp-grid">{[
      ['01 · Apply','Tell us about your work and your business-owner audience. We review every application.'],
      ['02 · Get approved','Receive your personal referral link. No campaigns, wallet or marketplace onboarding required.'],
      ['03 · Refer and earn','Share your link. Follow registrations, trials and commissions from your dashboard.'],
    ].map(([title,body]) => <article key={title} className="gp-card"><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="gp-card"><span className="gp-eyebrow">Your referral reward</span><h2 className="mt-3"><span className="gp-accent">50%</span> × the first three paid months</h2><p>Commission is based on eligible monthly subscription payments actually collected, after discounts and excluding GST, refunds and other fees. Free trials and failed payments do not earn commissions. There is no cost to join.</p></section>
    <section className="gp-section"><h2>For people business owners trust</h2><p>Creators, educators, media buyers, agencies, consultants, accountants and advisors: if you have a relevant business-owner audience or professional network, we would like to hear from you. Applications are selected for fit, relevance and credibility.</p></section>
    <section className="gp-card" id="application"><h2>Apply for the programme</h2><p className="mb-6">Tell us a little about yourself. We review every application.</p><ApplicationForm /></section>
    <section className="gp-section"><h2>A few useful details</h2>{[
      ['When are commissions paid?','Eligible payments enter a 14-day refund hold. Commissions and manual payouts are then reviewed and approved by Nettmark; payouts are not automatic.'],
      ['Does the free trial count?','No. You earn only when an eligible subscription payment is collected. The first three successful paid monthly periods are eligible.'],
      ['Is GST included in commission?','No. GST, refunds, discounts and non-eligible fees are excluded from the commission basis.'],
      ['Do I need to join the affiliate marketplace?','No. Growth Partners refer businesses. You can choose to join the affiliate marketplace separately.'],
      ['How long does a referral last?','The default referral window is 60 days from the first eligible click. Once a new business is attributed, its referral stays attached through the trial and subscription.'],
      ['Does it cost anything to join?','No. Applying and joining the programme are free.'],
    ].map(([question,answer]) => <details key={question} className="gp-card"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3">{answer}</p></details>)}</section>
    <p className="text-sm">By applying, you agree that we can contact you about your application. <Link className="gp-link" href="/legal/privacy">Privacy policy</Link></p>
  </main>;
}
