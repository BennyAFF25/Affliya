'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

export default function BusinessLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // LOGIN ONLY
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      const profileData = { id: data.user.id, email, role: 'business' };
      await supabase.from('profiles').upsert([profileData] as any);

      router.push('/auth-redirect');
    }

    setLoading(false);
  };

  return (
    <>
      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px black inset !important;
          -webkit-text-fill-color: white !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      <header className="flex items-center justify-between h-16 px-6 bg-black text-white border-b border-gray-700">
        <img src="/nettmark-logo.png" alt="Logo" width={140} height={40} />
        <div className="flex items-center justify-center space-x-10 w-full max-w-4xl mx-auto">
          <nav className="flex space-x-8">
            <a href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold">
              For Businesses
            </a>
            <a href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold">
              For Partners
            </a>
            <a href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold">
              Pricing
            </a>
          </nav>
        </div>
        <button
          onClick={() => router.push('/')}
          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold py-2 px-4 rounded"
        >
          Home
        </button>
      </header>
      <main className="flex items-center justify-center min-h-screen pt-0 bg-gradient-to-b from-[#0b1a1b] via-[#0b0b0b] to-black px-4">
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 p-10 rounded-2xl shadow-2xl shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition-shadow duration-500 max-w-md w-full text-white">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-[#00C2CB] to-[#7ff5fb] bg-clip-text text-transparent drop-shadow-md text-center">
            Business Login
          </h1>
          <p className="text-white/70 text-sm mb-8 text-center">
            Enter your email and password to continue.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col space-y-6 relative">
            <input
              type="email"
              placeholder="Email"
              className="p-4 rounded-lg bg-black/60 border border-[#00C2CB] text-white placeholder-[#7ff5fb] focus:outline-none focus:ring-2 focus:ring-[#00C2CB] transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                className="w-full p-4 rounded-lg bg-black/60 border border-[#00C2CB] text-white placeholder-[#7ff5fb] focus:outline-none focus:ring-2 focus:ring-[#00C2CB] transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-white/50 hover:text-[#00C2CB] text-sm"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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
            {error && <p className="text-red-500 text-center">{error}</p>}
          </form>
        </div>
      </main>
    </>
  );
}