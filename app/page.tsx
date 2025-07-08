'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';

export default function Home() {
  const session = useSession();
  const user = session?.user ?? null;
  const router = useRouter();
  const [userType, setUserType] = useState<'business' | 'affiliate' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBizWhy, setShowBizWhy] = useState(false);
  const [showAffWhy, setShowAffWhy] = useState(false);

  useEffect(() => {
    const storedUserType = localStorage.getItem('userType') as 'business' | 'affiliate' | null;
    if (user && storedUserType) {
      router.push(storedUserType === 'business' ? '/business/dashboard' : '/affiliate/dashboard');
    }
  }, [user, router]);

  const handleLogin = async (type: 'business' | 'affiliate') => {
    setUserType(type);
    localStorage.setItem('userType', type);
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const handleLogout = async () => {
    localStorage.removeItem('userType');
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <header className="w-full px-6 py-4 bg-gray-800 text-white flex justify-between items-center border-b border-gray-700">
        <h1 className="text-2xl font-bold text-[#00C2CB]">Affliya</h1>
        <div className="md:hidden">
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <nav className="hidden md:flex space-x-6">
          {user ? (
            <button onClick={handleLogout} className="text-white font-medium hover:underline">
              Sign out
            </button>
          ) : (
            <>
              <button onClick={() => handleLogin('business')} className="text-white font-medium hover:underline">
                Business Login
              </button>
              <button onClick={() => handleLogin('affiliate')} className="text-white font-medium hover:underline">
                Affiliate Login
              </button>
            </>
          )}
        </nav>
      </header>

      {menuOpen && (
        <div className="md:hidden px-6 py-4 space-y-4 bg-white shadow">
          {user ? (
            <button onClick={handleLogout} className="block w-full text-left text-[#00C2CB] font-medium">
              Sign out
            </button>
          ) : (
            <>
              <button onClick={() => handleLogin('business')} className="block w-full text-left text-[#00C2CB] font-medium">
                Business Login
              </button>
              <button onClick={() => handleLogin('affiliate')} className="block w-full text-left text-[#00C2CB] font-medium">
                Affiliate Login
              </button>
            </>
          )}
        </div>
      )}

      <main className="flex-1 flex flex-col text-center">
        <section
          className="relative w-full h-[500px] flex items-center justify-center px-6"
          style={{ backgroundImage: "url('/hero-banner.png')" }}
        >
          <div className="absolute inset-0 bg-black opacity-40 z-0" />
          <div className="z-10 max-w-3xl text-white">
            <h2 className="text-4xl md:text-6xl font-bold mb-4">Fuel Your Growth - Connect - Launch - Earn</h2>
            <p className="text-lg text-white max-w-xl mx-auto mb-8">
              The platform that turns performance into payouts — for businesses & affiliates.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => handleLogin('business')}
                className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold py-3 px-6 rounded"
              >
                Join as a Business
              </button>
              <button
                onClick={() => handleLogin('affiliate')}
                className="bg-white hover:bg-[#e0fafa] border border-[#00C2CB] text-[#00C2CB] font-semibold py-3 px-6 rounded"
              >
                Join as an Affiliate
              </button>
            </div>
          </div>
        </section>
      </main>

      <section className="text-left max-w-6xl mx-auto mb-20 mt-20 px-6">
        <div className="text-center mb-10">
          <h3 className="text-3xl font-semibold text-[#00C2CB]">
            Empower Your Business with Performance-Driven Promotion
          </h3>
        </div>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <img src="/graph-performance.png" alt="Business dashboard" className="rounded-lg shadow w-full max-w-md mx-auto" />
          <ul className="text-lg space-y-2">
            <li>✓ Set your offer, choose commissions</li>
            <li>✓ Connect your Meta Ads account</li>
            <li>✓ Approve affiliates with a click</li>
            <li>✓ Track performance in real-time</li>
          </ul>
        </div>
      </section>

      <section className="w-full bg-gray-800 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h4 className="font-semibold text-xl mb-2">Your Brand - Your Ads - More Reach</h4>
          <p>Affiliates run campaigns through your ad account — keeping your brand, data, and targeting fully under your control.</p>
        </div>
      </section>

      <section className="text-left max-w-6xl mx-auto mb-20 px-6 mt-16">
        <h3 className="text-3xl font-semibold text-[#00C2CB] mb-4 text-center">Earn Recurring Income Promoting Real Businesses</h3>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <ul className="text-lg space-y-2">
            <li>✓ Browse ready-to-promote offers</li>
            <li>✓ Launch ads directly through Affliya</li>
            <li>✓ Recurring monthly commissions</li>
            <li>✓ No product. No support. Just sales.</li>
          </ul>
          <img src="/marketplace-visual.png" alt="Affiliate" className="rounded-lg shadow" />
        </div>
      </section>

      <section className="bg-gray-800 py-10 mb-20 rounded-lg text-center shadow px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xl font-semibold text-white">
          <div>
            <div className="text-[#00C2CB] text-3xl">45k+</div>
            Affiliates
          </div>
          <div>
            <div className="text-[#00C2CB] text-3xl">6.2M</div>
            Monthly Ad Spend
          </div>
          <div>
            <div className="text-[#00C2CB] text-3xl">$3.5M</div>
            Paid to Affiliates
          </div>
          <div>
            <div className="text-[#00C2CB] text-3xl">9,200+</div>
            Offers Listed
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto mb-20 px-6">
        <h3 className="text-2xl font-bold mb-6 text-center">Why FalconX?</h3>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <button
              onClick={() => setShowBizWhy(!showBizWhy)}
              className="w-full text-left p-4 rounded-lg bg-[#00C2CB] text-white hover:bg-[#00b0b8] transition-colors duration-200"
            >
              <strong>Why Businesses Use Affliya</strong>
            </button>
            {showBizWhy && (
              <div className="p-4 border border-t-0 rounded-b-lg text-gray-700 bg-gray-100">
                <ul className="list-disc ml-6 space-y-2">
                  <li>Pay only after results</li>
                  <li>Brand-safe ad distribution</li>
                  <li>Scale campaigns without extra staff</li>
                </ul>
              </div>
            )}
          </div>
          <div>
            <button
              onClick={() => setShowAffWhy(!showAffWhy)}
              className="w-full text-left p-4 rounded-lg bg-[#00C2CB] text-white hover:bg-[#00b0b8] transition-colors duration-200"
            >
              <strong>Why Affiliates Use Affliya</strong>
            </button>
            {showAffWhy && (
              <div className="p-4 border border-t-0 rounded-b-lg text-gray-700 bg-gray-100">
                <ul className="list-disc ml-6 space-y-2">
                  <li>No product or clients needed</li>
                  <li>Launch ads directly from the platform</li>
                  <li>Recurring income from real brands</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto mb-20 px-6">
        <h3 className="text-2xl font-bold mb-6 text-center">Simple, Results-Based Pricing</h3>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow text-white">
            <h4 className="text-[#00C2CB] font-bold text-xl mb-2">For Businesses</h4>
            <p className="mb-4">Free to list. Pay $150/month only after you make sales through affiliates.</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Ad account integration</li>
              <li>Affiliate approval tools</li>
              <li>Real-time performance dashboard</li>
            </ul>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow text-white">
            <h4 className="text-[#00C2CB] font-bold text-xl mb-2">For Affiliates</h4>
            <p className="mb-4">Start free. Pay $50/month only after your first sale.</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Direct campaign launch</li>
              <li>Recurring commission payouts</li>
              <li>Access to top brand offers</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="w-full text-center py-4 border-t border-gray-200 text-sm text-gray-500">
        © {new Date().getFullYear()} Affliya. All rights reserved.
      </footer>
    </div>
  );
}