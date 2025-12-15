

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/../utils/supabase/pages-client';

interface AcceptTermsModalProps {
  userId: string;
  onAccepted?: () => void;
}

export default function AcceptTermsModal({
  userId,
  onAccepted,
}: AcceptTermsModalProps) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!checked) return;

    setLoading(true);
    setError(null);

    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      setError('Failed to save acceptance. Please try again.');
      setLoading(false);
      return;
    }

    setLoading(false);
    onAccepted?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b0f10] p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-[#00C2CB] mb-3">
          Accept Terms to Continue
        </h2>

        <p className="text-sm text-gray-300 mb-4">
          Before continuing, you must agree to Nettmark’s Terms and Privacy
          policies.
        </p>

        <div className="space-y-2 text-sm mb-4">
          <Link
            href="/legal/privacy/terms-of-service"
            target="_blank"
            className="block text-[#00C2CB] hover:underline"
          >
            Terms of Service
          </Link>
          <Link
            href="/legal/privacy"
            target="_blank"
            className="block text-[#00C2CB] hover:underline"
          >
            Privacy Policy
          </Link>
          <Link
            href="/legal/privacy/cookies"
            target="_blank"
            className="block text-[#00C2CB] hover:underline"
          >
            Cookie Policy
          </Link>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-200 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 accent-[#00C2CB]"
          />
          <span>
            I have read and agree to the Terms of Service and Privacy Policy
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-400 mb-3">{error}</p>
        )}

        <button
          onClick={handleAccept}
          disabled={!checked || loading}
          className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition ${
            checked
              ? 'bg-[#00C2CB] text-black hover:bg-[#00b0b8]'
              : 'bg-white/10 text-white/40 cursor-not-allowed'
          }`}
        >
          {loading ? 'Saving...' : 'Accept & Continue'}
        </button>
      </div>
    </div>
  );
}