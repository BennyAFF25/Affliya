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
    <div className="min-h-screen bg-[#0e0e0e] text-white px-8 py-12">
      <div className="bg-[#1a1a1a] shadow-md border border-[#222] rounded-xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="text-[#00C2CB]" size={24} />
          <h1 className="text-2xl font-bold text-[#00C2CB]">Business Settings</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Info */}
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Business Info</h2>

            <label className="block font-medium mb-1 text-white">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full p-3 bg-[#121212] border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2CB] text-white placeholder-gray-500"
              placeholder="e.g. FalconX Pty Ltd"
              required
            />

            <label className="block font-medium mt-4 mb-1 text-white">Email Address</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full p-3 bg-[#1e1e1e] border border-gray-600 rounded-lg text-gray-500 cursor-not-allowed"
            />

            <label className="block font-medium mt-4 mb-1 text-white">Website (optional)</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full p-3 bg-[#121212] border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2CB] text-white placeholder-gray-500"
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Payment Preferences */}
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Payout Method</h2>

            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 text-white">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'bank'}
                  onChange={() => setPaymentMethod('bank')}
                />
                Bank Transfer
              </label>
              <label className="flex items-center gap-2 text-white">
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
              className="w-full p-3 bg-[#121212] border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2CB] text-white placeholder-gray-500"
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