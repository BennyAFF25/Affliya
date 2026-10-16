import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function WalletBillingNotice({ loading, error, ready, onRetry }: {
  loading: boolean; error: boolean; ready: boolean; onRetry: () => void;
}) {
  if (loading) return <p role="status" className="mt-3 text-xs text-slate-400">Checking billing…</p>;
  if (error) return <p role="alert" className="mt-3 text-xs text-amber-200">Could not check billing. <button type="button" className="underline" onClick={onRetry}>Try again</button></p>;
  if (ready) return null;
  return <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3 text-xs leading-5 text-amber-100">
    <p className="font-semibold">Billing connection required</p>
    <p className="mt-1">Connect billing in Affiliate Settings before adding wallet funds or running ads.</p>
    <Link href="/affiliate/settings" className="mt-2 inline-flex items-center gap-1 font-semibold text-[#63e8ee]">Open settings <ArrowRight className="h-3.5 w-3.5" /></Link>
  </div>;
}
