'use client';
import React, { useState } from 'react';
import { Button, Field, Input, Label } from '../../../components/ui';

export function ReferralLink({ referralUrl }: { referralUrl: string | null }) {
  const [message, setMessage] = useState('');
  if (!referralUrl) return null;
  return (
    <div className="mt-4">
      <Field>
        <Label htmlFor="referral-link">Your referral link</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input id="referral-link" value={referralUrl} readOnly onFocus={event => event.currentTarget.select()} />
          <Button className="rounded-full" onClick={async () => {
            try {
              await navigator.clipboard.writeText(referralUrl);
              setMessage('Referral link copied.');
            } catch {
              setMessage('Select and copy the link above.');
            }
          }}>{message === 'Referral link copied.' ? 'Copied' : 'Copy link'}</Button>
        </div>
      </Field>
      <p role="status" className="mt-2 text-sm">{message}</p>
    </div>
  );
}

export default function DashboardActions({ profileRole }: { profileRole: string | null }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <h2>Join the affiliate marketplace</h2>
      <p>Promote offers separately. Your Growth Partner status stays the same.</p>
      {profileRole === 'business' ? (
        <p className="mt-3">This account already has a business profile. Continue using this dashboard for Growth Partner referrals.</p>
      ) : (
        <form onSubmit={async event => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          const username = new FormData(event.currentTarget).get('username');
          try {
            const response = await fetch('/api/growth-partners/join-marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            location.assign(result.redirect);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Please try again.');
          } finally { setBusy(false); }
        }}>
          {!profileRole && <Field className="mt-4"><Label htmlFor="username">Choose an affiliate username</Label><Input id="username" name="username" required pattern="[A-Za-z0-9_]{3,30}" maxLength={30} /></Field>}
          <Button variant="secondary" className="mt-4 rounded-full" disabled={busy}>{busy ? 'Joining…' : profileRole === 'affiliate' ? 'Continue to affiliate marketplace' : 'Join the affiliate marketplace'}</Button>
        </form>
      )}
      <p role="status" className="mt-4">{message}</p>
    </div>
  );
}
