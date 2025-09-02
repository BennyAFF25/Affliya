'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

export default function AffiliateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/auth-redirect');
  };

  return (
    <>
      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:hover,
        textarea:-webkit-autofill,
        textarea:-webkit-autofill:focus,
        select:-webkit-autofill {
          -webkit-box-shadow: 0 0 0px 1000px #0b0b0b inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      <header className="fixed top-0 left-0 w-full h-16 z-30 bg-black bg-opacity-70 backdrop-blur-md border-b border-white/10 flex items-center px-8">
        {/* Logo */}
        <div className="flex items-center h-full">
          <img
            src="/nettmark-logo.png"
            alt="Nettmark"
            width={140}
            height={40}
            className="object-contain"
          />
        </div>
        {/* Centered nav */}
        <nav className="absolute left-1/2 top-0 -translate-x-1/2 h-full flex items-center space-x-10">
          <a
            href="/business"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold text-base transition-colors"
          >
            For Businesses
          </a>
          <a
            href="/partners"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold text-base transition-colors"
          >
            For Partners
          </a>
          <a
            href="/pricing"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold text-base transition-colors"
          >
            Pricing
          </a>
        </nav>
        {/* Right side Home button */}
        <div className="ml-auto flex items-center h-full">
          <a
            href="/"
            className="px-5 py-2 rounded-lg bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition-all text-base"
          >
            Home
          </a>
        </div>
      </header>
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0b1a1b] via-[#0b0b0b] to-black px-4 pt-20">
        <div className="max-w-md w-full bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 p-10 rounded-2xl shadow-2xl shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition-shadow duration-500">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-[#00C2CB] to-[#7ff5fb] bg-clip-text text-transparent drop-shadow-md mb-6 text-center">
            Affiliate Login
          </h1>
          <p className="text-white/70 text-sm mb-8 text-center">Enter your email and password to continue.</p>
          <form onSubmit={handleLogin} className="flex flex-col space-y-6 w-full">
            <input
              type="email"
              placeholder="Email"
              className="p-4 rounded-lg bg-black/60 border border-[#00C2CB] text-white placeholder-[#7ff5fb] focus:outline-none focus:ring-2 focus:ring-[#00C2CB] transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                className="p-4 pr-16 rounded-lg bg-black/60 border border-[#00C2CB] text-white placeholder-[#7ff5fb] focus:outline-none focus:ring-2 focus:ring-[#00C2CB] transition w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-white/50 hover:text-[#00C2CB] text-sm"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 rounded-lg font-semibold bg-black border border-[#00C2CB] text-[#00C2CB] hover:bg-[#00C2CB] hover:text-black shadow-lg transition transform hover:scale-105 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Login'}
            </button>
            {error && <p className="text-red-500 font-medium text-sm mt-2">{error}</p>}
          </form>
        </div>
      </main>
    </>
  );
}