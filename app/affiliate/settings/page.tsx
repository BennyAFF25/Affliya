"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/../utils/supabase/pages-client';
import { Save } from 'lucide-react';
import { useSession } from '@supabase/auth-helpers-react';

export default function AffiliateSettingsPage() {
  const session = useSession();
  const user = session?.user;

  const [fullName, setFullName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [defaultCurrency, setDefaultCurrency] = useState('AUD');

  useEffect(() => {
    if (user?.email) {
      supabase
        .from('user_settings')
        .select('*')
        .eq('email', user.email)
        .single()
        .then(({ data, error }) => {
          if (data) {
            setFullName(data.full_name || '');
            setPaymentMethod(data.payment_method || 'paypal');
            setDefaultCurrency(data.default_currency || 'AUD');
          }
        });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.email) return alert('User not authenticated');

    const { data: existing } = await supabase
      .from('user_settings')
      .select('*')
      .eq('email', user.email)
      .single();

    let error = null;

    if (existing) {
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({
          full_name: fullName,
          payment_method: paymentMethod,
          default_currency: defaultCurrency,
        })
        .eq('email', user.email);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          email: user.email,
          full_name: fullName,
          payment_method: paymentMethod,
          default_currency: defaultCurrency,
        });
      error = insertError;
    }

    if (error) {
      console.error(error);
      alert('Error saving settings.');
    } else {
      alert('Settings saved successfully!');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-10">
      <div className="bg-white shadow-lg border border-gray-200 rounded-xl p-10">
        <div className="flex items-center gap-3 mb-6">
          <Save className="text-[#00C2CB]" size={26} />
          <h1 className="text-3xl font-bold text-[#00C2CB]">Affiliate Settings</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">Personal Info</h2>
              <label className="block font-medium mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
                placeholder="Your name"
                required
              />

              <label className="block font-medium mt-4 mb-1">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full p-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">Wallet Settings</h2>
              <label className="block font-medium mb-1">Default Currency</label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
              >
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="NZD">NZD - New Zealand Dollar</option>
                <option value="CAD">CAD - Canadian Dollar</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">Payout Method</h2>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'paypal'}
                    onChange={() => setPaymentMethod('paypal')}
                  />
                  PayPal
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
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">
                All transactions are automatically converted to your selected default currency for display.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}