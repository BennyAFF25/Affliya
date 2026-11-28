'use client';
import React from 'react';
import { useEffect, useState } from 'react';
export default function LoginForm() {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]); // native pre-hydration submit would put the email in the URL
  return <form onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true);
    const email = new FormData(event.currentTarget).get('email');
    try { const response = await fetch('/api/growth-partners/login', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email}) }); if (!response.ok) throw new Error(); setMessage('Check your inbox. If you have a Growth Partner account, a sign-in link will arrive shortly. The link expires soon. Didn’t get it? Try again.'); }
    catch { setMessage('Could not request a link. Please try again.'); } finally { setBusy(false); }
  }}><label className="gp-label">Email<input type="email" name="email" className="gp-input" required autoComplete="email" maxLength={254} /></label><button disabled={busy||!ready} aria-busy={!ready} className="gp-button">{busy ? 'Requesting…' : 'Email me a sign-in link'}</button><p role="status" className="mt-4">{message}</p></form>;
}
