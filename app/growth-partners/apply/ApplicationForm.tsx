'use client';
import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { trackMetaStandardEvent } from '../../../utils/marketing/metaPixel';

// Values must match utils/growthPartners/applications.ts (categories, audiences).
const categories: [string, string][] = [
  ['creator', 'Creator'], ['educator', 'Educator or coach'], ['media_buyer', 'Media buyer'], ['agency', 'Agency'],
  ['consultant', 'Consultant'], ['accountant_or_advisor', 'Accountant or business advisor'], ['other', 'Other'],
];
const audiences = ['<1k', '1k-10k', '10k-50k', '50k-250k', '250k+'];

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div className="gp-field">
    <label className="gp-field-label" htmlFor={id}>{label}</label>
    {children}
    {hint && <p id={`${id}-hint`} className="gp-field-hint">{hint}</p>}
  </div>;
}

export default function ApplicationForm() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(''), [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (done) return <div role="status" className="gp-apply-success" tabIndex={-1} ref={node => node?.focus()}>
    <CheckCircle2 className="gp-apply-success-icon" size={40} aria-hidden="true" />
    <h3>Application received</h3>
    <p>Thanks for applying. We review every application. If you&apos;re approved, we&apos;ll email <strong className="gp-apply-success-email">{done}</strong> with your referral link and sign-in instructions.</p>
  </div>;
  return <form className="gp-apply-form" noValidate={false} aria-busy={busy} onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const attribution = Object.fromEntries([...new URLSearchParams(location.search)].filter(([key]) => /^utm_/.test(key) || key === 'fbclid'));
      const response = await fetch('/api/growth-partners/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, attribution: { ...attribution, landing_referrer: document.referrer, landing_path: location.pathname } }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      setDone(String(fields.email || '').trim());
      if (result.event_id) trackMetaStandardEvent('Lead', {}, { eventID: result.event_id });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); } finally { setBusy(false); }
  }}>
    <div className="gp-form-grid">
      <Field id="gp-full-name" label="Full name"><input id="gp-full-name" className="gp-input" name="full_name" required maxLength={160} autoComplete="name" placeholder="Jane Citizen" /></Field>
      <Field id="gp-email" label="Email" hint="We'll send your decision here."><input id="gp-email" className="gp-input" type="email" name="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" aria-describedby="gp-email-hint" /></Field>
      <Field id="gp-category" label="What best describes you?"><select id="gp-category" className="gp-input" name="category" required defaultValue=""><option value="" disabled>Select one</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field id="gp-audience" label="Business owners you reach" hint="A rough estimate across your audience or network."><select id="gp-audience" className="gp-input" name="audience_estimate" required defaultValue="" aria-describedby="gp-audience-hint"><option value="" disabled>Select an estimate</option>{audiences.map(bucket => <option key={bucket} value={bucket}>{bucket}</option>)}</select></Field>
    </div>
    <Field id="gp-profile" label="Social profile or website" hint="Where we can see your work, e.g. LinkedIn, Instagram or your business site."><input id="gp-profile" className="gp-input" type="url" name="profile_url" placeholder="https://" required maxLength={1000} inputMode="url" aria-describedby="gp-profile-hint" /></Field>
    {error && <div role="alert" className="gp-apply-error"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span></div>}
    <button type="submit" className="gp-submit" disabled={busy || !ready} aria-busy={!ready || busy}>
      {busy ? <><Loader2 className="gp-spin" size={18} aria-hidden="true" />Submitting…</> : <>Submit application<ArrowRight size={18} aria-hidden="true" /></>}
    </button>
    <p className="gp-apply-secure"><Lock size={13} aria-hidden="true" />Free to apply. No need to run ads yourself.</p>
  </form>;
}
