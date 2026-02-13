"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/for-businesses", label: "For Businesses" },
  { href: "/for-partners", label: "For Partners" },
  { href: "/pricing", label: "Pricing" },
];

export default function MarketingHeader() {
  const router = useRouter();
  const { session, supabaseClient } = useSessionContext();
  const user = session?.user ?? null;
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogin = () => router.push("/login");

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    setMenuOpen(false);
    router.refresh();
  };

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 w-full px-4 sm:px-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl border-b border-white/10" />
        <div className="relative mx-auto max-w-7xl h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/nettmark-logo.png"
              alt="Nettmark"
              width={140}
              height={40}
              priority
              className="rounded-sm"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={handleLogout}
                className="hidden md:inline-flex text-sm font-medium text-white/70 hover:text-white transition"
              >
                Sign out
              </button>
            ) : (
              <button
                onClick={handleLogin}
                className="hidden md:inline-flex px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm font-semibold hover:bg-[#00b0b8] transition"
              >
                Login
              </button>
            )}

            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-md text-white hover:bg-white/10 transition"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div aria-hidden style={{ height: "calc(4rem + env(safe-area-inset-top))" }} />

      {menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 z-40 border-b border-white/10 bg-gradient-to-b from-black/95 via-black/92 to-black/90 backdrop-blur-xl">
          <div className="px-6 py-5 space-y-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Navigation</p>
            <div className="space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block text-base text-[#00C2CB] font-medium"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4 mt-3 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Account</p>
              {user ? (
                <button
                  onClick={handleLogout}
                  className="block w-full text-left text-base text-[#ffefef] font-medium"
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogin();
                  }}
                  className="block w-full text-left text-base text-[#00C2CB] font-medium"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
