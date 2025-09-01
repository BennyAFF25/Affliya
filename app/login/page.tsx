'use client';

import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6">
      <h1 className="text-3xl font-bold">Login</h1>
      <p className="text-gray-400">Select your role to log in. New users must first sign up via checkout.</p>
      <div className="flex space-x-4">
        <Link
          href="/login/affiliate"
          className="px-6 py-3 bg-[#00C2CB] text-white rounded-lg hover:bg-[#00b0b8]"
        >
          Affiliate Login
        </Link>
        <Link
          href="/login/business"
          className="px-6 py-3 bg-[#00C2CB] text-white rounded-lg hover:bg-[#00b0b8]"
        >
          Business Login
        </Link>
      </div>
    </div>
  );
}