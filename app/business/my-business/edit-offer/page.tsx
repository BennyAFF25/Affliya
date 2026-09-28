"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";

interface Offer {
  id: string;
  title: string;
  description: string;
  commission: number;
  type: string;
  price?: number | null;
  currency?: string | null;
  participation_mode?: "open" | "approval_required" | "private" | null;
}

function participationLabel(mode: Offer["participation_mode"]) {
  if (mode === "approval_required") return "Approval required";
  if (mode === "private") return "Private";
  return "Open";
}

export default function CurrentOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOffers = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user?.email) {
        setOffers([]);
        setError("We could not load your business offers right now.");
        setLoading(false);
        return;
      }

      const { data, error: offersError } = await (supabase as any)
        .from("offers")
        .select(
          "id,title,description,commission,type,price,currency,participation_mode",
        )
        .eq("business_email", user.email);

      if (cancelled) return;

      if (offersError) {
        console.error("[CurrentOffers] failed to load offers", offersError);
        setOffers([]);
        setError("Could not load your offers right now.");
      } else {
        setOffers((data || []) as Offer[]);
      }

      setLoading(false);
    };

    void loadOffers();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-[24px] border border-white/[0.09] bg-[#151718] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#7ff5fb]">
                Offers
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Current offers
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                View the offers currently available to affiliates and edit the details of any offer when you need to.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/business/my-business"
                prefetch={false}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.02] px-4 text-sm font-semibold text-slate-200 transition hover:border-[#00C2CB]/40 hover:text-white"
              >
                Back to My Business
              </Link>
              <Link
                href="/business/my-business/create-offer"
                prefetch={false}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#00C2CB] px-4 text-sm font-black text-black transition hover:bg-[#14d5de]"
              >
                New offer
              </Link>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-6 text-sm text-slate-400 shadow-2xl shadow-black/20">
            Loading your offers…
          </section>
        ) : error ? (
          <section className="rounded-[22px] border border-red-400/20 bg-red-500/[0.06] p-6 text-sm text-red-200">
            {error}
          </section>
        ) : offers.length === 0 ? (
          <section className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-6 shadow-2xl shadow-black/20 sm:p-8">
            <h2 className="text-lg font-semibold text-white">No offers yet</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Create your first offer and it will appear here whenever you want to review or edit it.
            </p>
            <Link
              href="/business/my-business/create-offer"
              prefetch={false}
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full bg-[#00C2CB] px-5 text-sm font-black text-black transition hover:bg-[#14d5de]"
            >
              Create offer
            </Link>
          </section>
        ) : (
          <section className="grid gap-4">
            {offers.map((offer) => (
              <article
                key={offer.id}
                className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20 sm:p-6"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-white">
                        {offer.title}
                      </h2>
                      <span className="rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/[0.08] px-2.5 py-1 text-[10px] font-bold text-[#67e7ed]">
                        {participationLabel(offer.participation_mode)}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400">
                      {offer.description || "No description added yet."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/[0.09] bg-black/10 px-3 py-1.5">
                        {offer.commission}% commission
                      </span>
                      <span className="rounded-full border border-white/[0.09] bg-black/10 px-3 py-1.5 capitalize">
                        {offer.type === "recurring" ? "Recurring" : "One-time"}
                      </span>
                      {offer.price != null ? (
                        <span className="rounded-full border border-white/[0.09] bg-black/10 px-3 py-1.5">
                          {offer.currency ? `${offer.currency} ` : ""}
                          {Number(offer.price).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <Link
                    href={`/business/my-business/edit-offer/${offer.id}`}
                    prefetch={false}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#00C2CB] px-5 text-sm font-black text-black transition hover:bg-[#14d5de]"
                  >
                    Edit offer
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
