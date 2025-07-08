'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useSession } from '@supabase/auth-helpers-react';

export default function BusinessSettingsPage() {
  const session = useSession();
  const user = session?.user;

  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'stripe'>('bank');
  const [paymentDetails, setPaymentDetails] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Saving logic here
    alert('✅ Business settings saved!');
  };

  return (
    <div className="max-w-2xl mx-auto p-10">
      <div className="bg-white shadow-md border border-gray-200 rounded-xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="text-[#00C2CB]" size={24} />
          <h1 className="text-2xl font-bold text-[#00C2CB]">Business Settings</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Info */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">Business Info</h2>

            <label className="block font-medium mb-1">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
              placeholder="e.g. FalconX Pty Ltd"
              required
            />

            <label className="block font-medium mt-4 mb-1">Email Address</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full p-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />

            <label className="block font-medium mt-4 mb-1">Website (optional)</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Payment Preferences */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">Payout Method</h2>

            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'bank'}
                  onChange={() => setPaymentMethod('bank')}
                />
                Bank Transfer
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'stripe'}
                  onChange={() => setPaymentMethod('stripe')}
                />
                Stripe
              </label>
            </div>

            <input
              type="text"
              value={paymentDetails}
              onChange={(e) => setPaymentDetails(e.target.value)}
              placeholder={
                paymentMethod === 'bank'
                  ? 'Bank account or BSB/Acct #'
                  : 'Stripe email or payout link'
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
              required
            />
          </div>

          <button
            type="submit"
            className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            Save Settings
          </button>
        </form>
      </div>
    </div>
  );
}