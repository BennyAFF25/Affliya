'use client';

import { useState, FormEvent } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import toast from 'react-hot-toast';

export default function ResetPasswordRequestPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      toast.error(error.message || 'Failed to send reset link');
      setMessage(error.message);
    } else {
      toast.success('Reset link sent');
      setMessage('Check your email for a password reset link.');
    }

    setSending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#040509] text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_60px_rgba(0,194,203,0.15)]">
        <h1 className="text-xl font-semibold mb-2 text-[#00C2CB]">
          Reset your password
        </h1>
        <p className="text-xs text-white/70 mb-4">
          Enter the email you use for Nettmark and we&apos;ll send you a secure reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] text-white/60 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-medium text-black hover:bg-[#00b0b8] disabled:opacity-60"
          >
            {sending ? 'Sending link…' : 'Send reset link'}
          </button>
        </form>

        {message && (
          <p className="mt-3 text-[11px] text-white/70">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}