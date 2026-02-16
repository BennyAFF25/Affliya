"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useSessionContext } from "@supabase/auth-helpers-react";

const navLinks = [
  {
    href: "/",
    label: "Home",
    description: "Start here",
    badge: "New",
    group: "Platform",
  },
  {
    href: "/for-businesses",
    label: "For Businesses",
    description: "Pay on performance",
    group: "Solutions",
  },
  {
    href: "/for-partners",
    label: "For Partners",
    description: "UGC & paid media",
    group: "Solutions",
  },
  {
    href: "/pricing",
    label: "Pricing",
    description: "Early access",
    badge: "Free",
    group: "Plan",
  },
];

type NavLink = (typeof navLinks)[number];

export default function MarketingHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, supabaseClient } = useSessionContext();
  const user = session?.user ?? null;
  const [menuOpen, setMenuOpen] = useState(false);

  const groupedNav = useMemo(() => {
    const groups: Record<string, NavLink[]> = {};
    navLinks.forEach((link) => {
      groups[link.group] ??= [];
      groups[link.group].push(link);
    });

    return Object.entries(groups).map(([title, links]) => ({ title, links }));
  }, []);

  const handleLogin = () => router.push("/login");

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    setMenuOpen(false);
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 w-full px-4 sm:px-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-white/5 opacity-20" />
          <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

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

          <nav className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "relative px-4 py-1.5 text-sm font-medium transition-colors",
                    active ? "text-black" : "text-white/70 hover:text-white"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="marketing-nav-highlight"
                      className="absolute inset-0 rounded-full bg-white text-black"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {link.label}
                    {link.badge && (
                      <span className="text-[10px] uppercase tracking-widest text-black/80 bg-white/70 rounded-full px-2 py-0.5">
                        {link.badge}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
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
                className="hidden md:inline-flex px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm font-semibold shadow-[0_0_30px_#00C2CB44] hover:bg-[#00b0b8] transition"
              >
                Login
              </button>
            )}

            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className={clsx(
                "relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB] md:hidden",
                menuOpen && "border-white/30 bg-white/10 shadow-[0_10px_40px_-12px_#00C2CB]"
              )}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              <span
                className={clsx(
                  "absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity",
                  menuOpen && "opacity-60"
                )}
                aria-hidden
              />
              <span className="flex flex-col gap-1.5">
                {[0, 1, 2].map((line) => (
                  <span
                    key={line}
                    className={clsx(
                      "block h-0.5 w-5 rounded-full bg-current transition-all",
                      menuOpen && line === 1 && "w-3 opacity-70"
                    )}
                  />
                ))}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div aria-hidden style={{ height: "calc(4rem + env(safe-area-inset-top))" }} />

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="md:hidden fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] bottom-4 z-40 px-4"
          >
            <div className="relative h-full overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-black/92 via-black/90 to-[#040b0b]/95 backdrop-blur-2xl shadow-[0_30px_120px_-50px_#00C2CB]">
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at top, rgba(0,194,203,0.5), transparent 55%)" }} aria-hidden />

              <div className="relative h-full flex flex-col">
                <div className="px-6 pt-6 pb-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40"> Navigate </p>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8">
                  {groupedNav.map((group) => (
                    <div key={group.title} className="space-y-3">
                      <p className="text-[12px] uppercase tracking-[0.25em] text-white/35">{group.title}</p>
                      <div className="space-y-2">
                        {group.links.map((link) => (
                          <button
                            key={link.href}
                            onClick={() => {
                              setMenuOpen(false);
                              router.push(link.href);
                            }}
                            className="w-full text-left"
                          >
                            <span className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/30 hover:bg-white/10">
                              <span>
                                <span className="text-base font-medium text-white">
                                  {link.label}
                                </span>
                                <span className="block text-sm text-white/60">{link.description}</span>
                              </span>
                              {link.badge && (
                                <span className="text-[10px] rounded-full border border-white/30 px-2 py-0.5 text-white/80">
                                  {link.badge}
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#022426] via-[#041a1c] to-black p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#7ff5fb]">Need a walkthrough?</p>
                    <p className="mt-2 text-lg font-semibold text-white">Book a 15-min product tour.</p>
                    <p className="mt-1 text-sm text-white/70">We’ll show you the partner workflow + Nettmark Shop.</p>
                    <Link
                      href="/for-businesses"
                      onClick={() => setMenuOpen(false)}
                      className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black shadow-[0_12px_40px_-20px_#00C2CB]"
                    >
                      Talk to us
                    </Link>
                  </div>

                  <div className="space-y-3 border-t border-white/10 pt-5">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-white/35">Account</p>
                    {user ? (
                      <button
                        onClick={handleLogout}
                        className="w-full rounded-2xl border border-white/15 px-4 py-3 text-left text-white hover:border-white/40"
                      >
                        Sign out
                      </button>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/login?role=business");
                          }}
                          className="rounded-2xl border border-white/15 px-4 py-3 text-left text-white hover:border-white/40"
                        >
                          Business Login
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/login?role=affiliate");
                          }}
                          className="rounded-2xl border border-white/15 px-4 py-3 text-left text-white hover:border-white/40"
                        >
                          Partner Login
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
