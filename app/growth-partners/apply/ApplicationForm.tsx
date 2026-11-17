'use client';
import React from 'react';
import { useState } from 'react';
import { trackMetaStandardEvent } from '../../../utils/marketing/metaPixel';
const categories = ['creator','educator','media_buyer','agency','consultant','accountant_or_advisor','other'];
export default function ApplicationForm() {
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [done,setDone] = useState(false);
  if (done) return <div role="status"><h3>Thank you for applying.</h3><p>We review every application. If approved, you will receive your referral link and sign-in instructions by email.</p></div>;
  return <form onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const attribution = Object.fromEntries([...new URLSearchParams(location.search)].filter(([key]) => /^utm_/.test(key) || key === 'fbclid'));
      const response = await fetch('/api/growth-partners/apply',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...fields, attribution: { ...attribution, landing_referrer: document.referrer } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      setDone(true);
      if (result.event_id) trackMetaStandardEvent('Lead', {}, { eventID: result.event_id });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); } finally { setBusy(false); }
  }}><div className="gp-form-grid">
    <label className="gp-label">Full name<input className="gp-input" name="full_name" required maxLength={160} autoComplete="name" /></label>
    <label className="gp-label">Email<input className="gp-input" type="email" name="email" required maxLength={254} autoComplete="email" /></label>
    <label className="gp-label">Your professional category<select className="gp-input" name="category" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map(category => <option key={category} value={category}>{category.replaceAll('_',' ')}</option>)}</select></label>
    <label className="gp-label">Estimated business-owner audience<select className="gp-input" name="audience_estimate" required defaultValue=""><option value="" disabled>Select an estimate</option>{['<1k','1k-10k','10k-50k','50k-250k','250k+'].map(bucket => <option key={bucket}>{bucket}</option>)}</select></label>
  </div><label className="gp-label">Social profile or website<input className="gp-input" type="url" name="profile_url" placeholder="https://" required maxLength={1000} /></label>
    {error && <p role="alert" className="gp-error">{error}</p>}<button className="gp-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
  </form>;
}
