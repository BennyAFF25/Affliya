'use client';

import Link from 'next/link';
import Image from 'next/image';
import { User, Briefcase } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-[#00363a] via-black to-black">
      <header className="fixed top-0 inset-x-0 z-50 bg-black bg-opacity-90 backdrop-blur-sm border-b border-white/10">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
          <div className="w-full h-16 flex items-center justify-between border-b border-white/10 lg:border-none">
            <div className="flex items-center">
              <Link href="/" className="flex items-center -ml-2">
                <Image 
                  src="/nettmark-logo.png" 
                  alt="Affliya" 
                  width={140} 
                  height={40} 
                  priority 
                  className="rounded-sm" 
                />
              </Link>
              <div className="flex justify-center absolute left-1/2 -translate-x-1/2 space-x-8">
                <Link href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-medium">
                  For Businesses
                </Link>
                <Link href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-medium">
                  For Partners
                </Link>
                <Link href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-medium">
                  Pricing
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <Link
                href="/"
                className="inline-block rounded-md border border-transparent bg-[#00C2CB] py-2 px-4 text-base font-medium text-black hover:bg-[#00b0b8]"
              >
                Home
              </Link>
            </div>
          </div>
        </nav>
      </header>
      <div aria-hidden="true" className="h-20" />
      <div className="flex-grow flex items-center justify-center">
        <div className="w-full max-w-md bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 p-10 rounded-2xl shadow-2xl flex flex-col items-center space-y-8 opacity-0 translate-y-5 animate-fade-in-up shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition-shadow duration-500">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-[#00C2CB] to-[#7ff5fb] bg-clip-text text-transparent drop-shadow-md">
            Login
          </h1>
          <p className="text-white/70 max-w-md text-center">
            Select your role to log in. New users must first sign up via checkout.
          </p>
          <div className="flex flex-col space-y-4 w-full">
            <Link
              href="/login/affiliate"
              className="w-full px-8 py-4 rounded-lg font-semibold bg-black border border-[#00C2CB] text-[#00C2CB] hover:bg-[#00C2CB] hover:text-black shadow-lg transition transform hover:scale-105 text-lg text-center flex items-center justify-center"
            >
              <User className="inline-block mr-2 text-[#7ff5fb]" size={18} /> Affiliate Login
            </Link>
            <Link
              href="/login/business"
              className="w-full px-8 py-4 rounded-lg font-semibold bg-black border border-[#00C2CB] text-[#00C2CB] hover:bg-[#00C2CB] hover:text-black shadow-lg transition transform hover:scale-105 text-lg text-center flex items-center justify-center"
            >
              <Briefcase className="inline-block mr-2 text-[#7ff5fb]" size={18} /> Business Login
            </Link>
          </div>
          <div className="pt-2 text-sm text-white/50">
            Don’t have an account?{' '}
            <Link href="/pricing" className="text-[#00C2CB] hover:underline">
              Sign up via Pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}