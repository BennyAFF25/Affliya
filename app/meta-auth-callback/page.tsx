"use client";

import React, { useEffect } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";

export default function MetaAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    console.log("[📥 Meta Redirect Params]", { code, state });

    // TODO: send `code` to your API to exchange for access_token
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--foreground)]">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(0,194,203,0.16),rgba(255,255,255,0.96)_42%,rgba(0,194,203,0.08))] p-8 text-center shadow-[0_28px_90px_rgba(15,23,42,0.1)] dark:bg-[linear-gradient(135deg,rgba(0,194,203,0.2),rgba(17,24,39,0.94)_42%,rgba(0,194,203,0.1))] md:p-12">
          <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-[var(--primary)]/15 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-[var(--border)] bg-[var(--card)]/80 shadow-sm backdrop-blur">
              <LoaderCircle className="h-10 w-10 animate-spin text-[var(--primary)]" />
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/75 px-3 py-1 text-xs font-semibold text-[var(--primary)] backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure Meta handoff
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
              Finalising your Meta connection
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--muted-foreground)] md:text-base">
              We&apos;ve got the handoff from Meta. Nettmark is now wrapping up the account sync so your pages and ad accounts can show up in the dashboard.
            </p>

            <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
              {[
                "Checking the Meta response",
                "Saving connected assets",
                "Preparing your dashboard",
              ].map((step, index) => (
                <div
                  key={step}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/78 p-4 backdrop-blur"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                    {index < 2 ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-[var(--primary)]" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
                    )}
                    Step {index + 1}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">{step}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              You can leave this tab open for a moment while the sync finishes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
