'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const prepareRecoverySession = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');

      if (tokenHash && type === 'recovery') {
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        }).catch((err) => {
          console.warn('[update-password] recovery token verification failed', err);
        });
      } else if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch((err) => {
          console.warn('[update-password] recovery code exchange failed', err);
        });
      }

      setReady(true);
    };

    void prepareRecoverySession();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message || 'Failed to update password');
    } else {
      toast.success('Password updated');
      router.push('/login');
    }

    setSaving(false);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#040509] px-4 py-8 text-white sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_60px_rgba(0,194,203,0.15)] sm:p-6">
        <div className="mb-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#00C2CB]/35 bg-[#00C2CB]/10 text-[#7ff5fb]">
            🔒
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#00C2CB]">
            Set a new password
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Choose a new password for your Nettmark account. Use at least 6 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/65">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 pr-16 text-base text-white placeholder-white/40 outline-none focus:border-[#00C2CB] focus:ring-1 focus:ring-[#00C2CB]"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-white/55 hover:text-[#7ff5fb]"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/65">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 pr-16 text-base text-white placeholder-white/40 outline-none focus:border-[#00C2CB] focus:ring-1 focus:ring-[#00C2CB]"
                placeholder="Re-enter password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((value) => !value)}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-white/55 hover:text-[#7ff5fb]"
              >
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !ready}
            className="w-full rounded-full bg-[#00C2CB] px-4 py-3 text-base font-semibold text-black shadow-[0_0_20px_#00C2CB40] transition hover:bg-[#00b0b8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!ready ? 'Preparing secure link…' : saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
