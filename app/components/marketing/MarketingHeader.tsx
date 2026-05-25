"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Moon, Sun } from "lucide-react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useTheme } from "@/../context/ThemeContext";

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

export default function MarketingHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, supabaseClient } = useSessionContext();
  const { theme, toggleTheme } = useTheme();
  const user = session?.user ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolvedTheme = mounted ? theme : "dark";

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
              src={
                resolvedTheme === "dark"
                  ? "/nettmark-logo-dark.svg"
                  : "/nettmark-logo-light.svg"
              }
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
                    active
                      ? "text-[var(--primary-foreground)]"
                      : "text-white/70 hover:text-white",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="marketing-nav-highlight"
                      className="absolute inset-0 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
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
            <button
              onClick={toggleTheme}
              className="hidden md:inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/80 transition hover:border-white/30 hover:bg-white/10"
              aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
              {resolvedTheme === "dark" ? "Light" : "Dark"}
            </button>

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
                menuOpen &&
                  "border-white/30 bg-white/10 shadow-[0_10px_40px_-12px_#00C2CB]",
              )}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              <span
                className={clsx(
                  "absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity",
                  menuOpen && "opacity-60",
                )}
                aria-hidden
              />
              <span className="flex flex-col gap-1.5">
                {[0, 1, 2].map((line) => (
                  <span
                    key={line}
                    className={clsx(
                      "block h-0.5 w-5 rounded-full bg-current transition-all",
                      menuOpen && line === 1 && "w-3 opacity-70",
                    )}
                  />
                ))}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        aria-hidden
        style={{ height: "calc(4rem + env(safe-area-inset-top))" }}
      />

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 px-4 md:hidden"
          >
            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,10,14,0.97),rgba(5,8,11,0.95))] p-2.5 shadow-[0_24px_80px_-32px_rgba(0,194,203,0.45)] backdrop-blur-2xl">
              <div
                className="absolute inset-0 opacity-35"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at top, rgba(0,194,203,0.28), transparent 58%)",
                }}
                aria-hidden
              />

              <div className="relative space-y-2">
                <div className="space-y-1.5">
                  {navLinks.map((link) => {
                    const active = isActive(link.href);
                    return (
                      <button
                        key={link.href}
                        onClick={() => {
                          setMenuOpen(false);
                          router.push(link.href);
                        }}
                        className={clsx(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition",
                          active
                            ? "bg-[#00C2CB]/14 text-white shadow-[0_10px_30px_-20px_rgba(0,194,203,0.9)] ring-1 ring-[#00C2CB]/25"
                            : "bg-white/[0.03] text-white/82 hover:bg-white/[0.06]",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={clsx(
                              "h-2 w-2 rounded-full",
                              active ? "bg-[#00C2CB] shadow-[0_0_12px_#00C2CB]" : "bg-white/20",
                            )}
                          />
                          <span className="text-[13px] font-medium leading-none">
                            {link.label}
                          </span>
                        </div>
                        <ChevronRight
                          className={clsx(
                            "h-4 w-4 transition",
                            active ? "text-[#7ff5fb]" : "text-white/35",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-white/8 pt-2">
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-[12px] font-medium text-white/82 transition hover:bg-white/[0.07]"
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                  </button>

                  {user ? (
                    <button
                      onClick={handleLogout}
                      className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-[12px] font-medium text-white/82 transition hover:bg-white/[0.07]"
                    >
                      Sign out
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/login");
                      }}
                      className="rounded-xl bg-[#00C2CB] px-3 py-2.5 text-[12px] font-semibold text-black shadow-[0_10px_30px_-18px_rgba(0,194,203,0.75)] transition hover:bg-[#00b0b8]"
                    >
                      Login
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
