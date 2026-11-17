'use client';
import React from 'react';
import { useState } from 'react';
export default function DashboardActions({referralUrl,profileRole}:{referralUrl:string|null;profileRole:string|null}) {
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  return <div>{referralUrl && <div className="my-4"><p className="break-all font-mono">{referralUrl}</p><button className="gp-button" onClick={async()=>{try { await navigator.clipboard.writeText(referralUrl);setMessage('Referral link copied.'); } catch {setMessage('Select and copy the link above.');}}}>Copy referral link</button></div>}
    <div className="mt-8 border-t border-white/10 pt-6"><h3>Want to promote offers too?</h3><p>Join the Nettmark affiliate marketplace separately. Your Growth Partner status stays the same.</p>{profileRole==='business' ? <p className="mt-3">This account already has a business profile. Continue using this dashboard for Growth Partner referrals.</p> : <form onSubmit={async event=>{
      event.preventDefault();if(busy)return;setBusy(true);
      const username=new FormData(event.currentTarget).get('username');
      try {const response=await fetch('/api/growth-partners/join-marketplace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});const result=await response.json();if(!response.ok)throw new Error(result.error);location.assign(result.redirect);}catch(error){setMessage(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}
    }}>{!profileRole && <label className="gp-label mt-4">Choose an affiliate username<input className="gp-input" name="username" required pattern="[A-Za-z0-9_]{3,30}" maxLength={30} /></label>}<button disabled={busy} className="gp-button">{busy?'Joining…':profileRole==='affiliate'?'Continue to affiliate marketplace':'Join the affiliate marketplace'}</button></form>}</div><p role="status" className="mt-4">{message}</p></div>;
}
