'use client';

import { useState, FormEvent } from 'react';
import toast from 'react-hot-toast';

export default function ResetPasswordRequestPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);

    try {
      await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      toast.success('Reset link sent');
      setMessage('If an account exists for that email, a reset link has been sent.');
    } catch (error) {
      console.error('[reset-password] request failed', error);
      toast.error('Failed to send reset link');
      setMessage('Failed to send reset link. Please try again.');
    }

    setSending(false);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#040509] px-4 py-8 text-white sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_60px_rgba(0,194,203,0.15)] sm:p-6">
        <div className="mb-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#00C2CB]/35 bg-[#00C2CB]/10 text-[#7ff5fb]">
            ✉️
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#00C2CB]">
            Reset your password
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Enter the email you use for Nettmark and we&apos;ll send you a secure reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/65">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#00C2CB] focus:ring-1 focus:ring-[#00C2CB]"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-full bg-[#00C2CB] px-4 py-3 text-base font-semibold text-black shadow-[0_0_20px_#00C2CB40] transition hover:bg-[#00b0b8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? 'Sending link…' : 'Send reset link'}
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/75">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
