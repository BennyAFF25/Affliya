"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PartnerOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    async function finish() {
      try {
        await fetch("/api/profile/onboarding-complete", { method: "POST" });
      } catch (err) {
        console.warn("[onboarding redirect] failed to mark complete", err);
      } finally {
        router.replace("/affiliate/dashboard");
      }
    }

    void finish();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-black/40 px-6 py-10 text-center shadow-[0_25px_70px_rgba(0,0,0,0.55)]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C2CB]" />
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">
            Redirecting
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Heading to your affiliate dashboard
          </h1>
          <p className="mt-2 text-sm text-white/65">
            We replaced the old onboarding steps with the new checklist. Sit
            tight — you'll be there in a moment.
          </p>
          <button
            onClick={() => router.replace("/affiliate/dashboard")}
            className="mt-4 rounded-full border border-white/10 bg-[#111317] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-[#15191c]"
          >
            Jump to dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
