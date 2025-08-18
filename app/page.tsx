'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const { session, isLoading } = useSessionContext();
  const user = session?.user ?? null;
  const router = useRouter();
  const [userType, setUserType] = useState<'business' | 'affiliate' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBizWhy, setShowBizWhy] = useState(false);
  const [showAffWhy, setShowAffWhy] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const redirectFromOAuth =
      window.location.pathname === '/' &&
      !session?.user?.email?.endsWith('@example.com');
    const storedType = localStorage.getItem('userType');

    if (redirectFromOAuth && session?.user && storedType) {
      const alreadyRedirected =
        (storedType === 'affiliate' && window.location.pathname === '/affiliate/dashboard') ||
        (storedType === 'business' && window.location.pathname === '/business/dashboard');

      if (!alreadyRedirected) {
        if (storedType === 'affiliate') {
          router.push('/affiliate/dashboard');
        } else if (storedType === 'business') {
          router.push('/business/dashboard');
        }
      }
    }
  }, [isLoading, session, router]);

  const handleLogin = async (type: 'business' | 'affiliate') => {
    setUserType(type);
    localStorage.setItem('userType', type);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/redirect?type=${type}`,
      },
    });
  };

  const handleLogout = async () => {
    localStorage.removeItem('userType');
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      <header className="w-full h-16 px-6 bg-black/80 backdrop-blur text-white flex justify-between items-center border-b border-white/10 sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2 group">
          <Image src="/nettmark-logo.png" alt="Affliya" width={140} height={40} priority className="rounded-sm" />
        </Link>

        {/* Desktop primary nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm justify-center absolute left-1/2 transform -translate-x-1/2">
          <Link href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">For Businesses</Link>
          <Link href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">For Partners</Link>
          <Link href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">Pricing</Link>
        </nav>

        <div className="md:hidden">
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {user ? (
            <button onClick={handleLogout} className="text-white font-semibold hover:underline">Sign out</button>
          ) : (
            <>
              <button onClick={() => handleLogin('business')} className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors">Business Login</button>
              <button onClick={() => handleLogin('affiliate')} className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors">Affiliate Login</button>
            </>
          )}
        </nav>
      </header>

      {menuOpen && (
        <div className="md:hidden px-6 py-4 space-y-4 bg-white shadow">
          {/* Mobile primary nav */}
          <Link href="/for-businesses" className="block w-full text-left text-[#00C2CB] font-medium">For Businesses</Link>
          <Link href="/for-partners" className="block w-full text-left text-[#00C2CB] font-medium">For Partners</Link>
          <Link href="/pricing" className="block w-full text-left text-[#00C2CB] font-medium">Pricing</Link>

          <div className="border-t border-gray-200 pt-4" />

          {user ? (
            <button onClick={handleLogout} className="block w-full text-left text-[#00C2CB] font-medium">Sign out</button>
          ) : (
            <>
              <button onClick={() => handleLogin('business')} className="block w-full text-left text-[#00C2CB] font-medium">Business Login</button>
              <button onClick={() => handleLogin('affiliate')} className="block w-full text-left text-[#00C2CB] font-medium">Affiliate Login</button>
            </>
          )}
        </div>
      )}

      <main className="flex-1">
        {/* HERO */}
        <section className="relative">
          <div className="absolute inset-0 pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent_90%)]">
            {/* subtle glow behind hero */}
            <div className="mx-auto max-w-7xl h-[420px] blur-3xl opacity-30 bg-gradient-to-r from-[#00C2CB] via-[#7ff5fb] to-transparent" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              {/* Left: Text */}
              <div>
                <h2 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
                  Grow Faster with <span className="text-[#7ff5fb]">Performance‑Based</span><br className="hidden md:block" /> Promotion
                </h2>
                <p className="mt-4 text-white/70 text-lg max-w-xl">
                  Affliya connects your brand to thousands of affiliates ready to drive revenue.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleLogin('business')}
                    className="px-6 py-3 rounded-lg bg-[#00C2CB] text-black font-semibold shadow-[0_0_40px_#00C2CB55] hover:bg-[#00b0b8] transition-colors"
                  >
                    Get Started Free
                  </button>
                  <button
                    onClick={() => handleLogin('affiliate')}
                    className="px-6 py-3 rounded-lg border border-white/15 text-white hover:bg-white/5 transition-colors"
                  >
                    Learn How It Works
                  </button>
                </div>
              </div>

              {/* Right: Visual placeholder (you can replace src later) */}
              <div className="relative">
                <div className="absolute -inset-4 rounded-2xl bg-[#00C2CB]/10 blur-2xl" />
                <div className="relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-2xl">
                  <img
                    src="/marketplace-visual.png"
                    alt="Product preview"
                    className="w-full h-[360px] object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section id="for-businesses" className="text-left max-w-6xl mx-auto mb-20 mt-20 px-6">
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

      <section id="for-partners" className="text-left max-w-6xl mx-auto mb-20 px-6 mt-16">
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

      <section id="pricing" className="max-w-6xl mx-auto mb-20 px-6">
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