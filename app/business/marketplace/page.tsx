"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";

interface Offer {
  id: string;
  businessName: string;
  description: string;
  commission: number;
  type: string;
  website: string;
}

export default function BusinessMarketplace() {
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase.from("offers").select("*");
      if (error) {
        console.error("[❌ Error fetching offers]", error.message);
      } else if (data) {
        setOffers(data);
      }
    };

    fetchOffers();
  }, []);

  return (
    <div className="business-marketplace-theme min-h-screen bg-[var(--background)] p-8 text-[var(--foreground)]">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--primary)]">
          Business Marketplace
        </h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Monitor active offers across the network and keep tabs on competitor
          positioning.
        </p>
      </div>

      {offers.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)]/45 hover:shadow-[0_22px_60px_rgba(0,0,0,0.14)]"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-sm font-semibold text-emerald-400">
                  Verified
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
                  {offer.type === "recurring" ? "Recurring" : "One-time"}
                </span>
              </div>

              <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
                {offer.businessName}
              </h2>
              <p className="mb-4 text-sm text-[var(--muted-foreground)]">
                {offer.description}
              </p>

              <div className="mb-4 flex items-center text-sm font-medium text-[var(--primary)]">
                <svg
                  className="mr-1 h-4 w-4 text-[var(--primary)]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1C8.13 1 5 4.13 5 8c0 4.5 7 13 7 13s7-8.5 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 5.5 12 5.5 14.5 6.62 14.5 8 13.38 10.5 12 10.5z" />
                </svg>
                Commission: {offer.commission}%
              </div>

              <a
                href={offer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-md bg-[var(--primary)] py-2 text-center text-[var(--primary-foreground)] transition hover:brightness-110"
              >
                View Details
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="italic text-[var(--muted-foreground)]">
          No offers available yet.
        </p>
      )}
    </div>
  );
}
