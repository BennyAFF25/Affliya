'use client';

import { useState, FormEvent } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
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
      // send them to login or straight into app
      router.push('/login');
    }

    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#040509] text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_60px_rgba(0,194,203,0.15)]">
        <h1 className="text-xl font-semibold mb-2 text-[#00C2CB]">
          Set a new password
        </h1>
        <p className="text-xs text-white/70 mb-4">
          Enter a new password for your Nettmark account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] text-white/60 mb-1">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
            />
          </div>
          <div>
            <label className="block text-[11px] text-white/60 mb-1">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-medium text-black hover:bg-[#00b0b8] disabled:opacity-60"
          >
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}