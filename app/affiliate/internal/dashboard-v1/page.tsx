"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(amount);
}

type OfferRow = { id: string; title: string };

export default function AffiliateDashboardV1() {
  const [email, setEmail] = useState<string>("");
  const [requested, setRequested] = useState(false);
  const [approvedOfferId, setApprovedOfferId] = useState<string | null>(null);
  const [approvedOfferName, setApprovedOfferName] = useState<string>("");
  const [launchedCampaign, setLaunchedCampaign] = useState(false);
  const [firstClick, setFirstClick] = useState(false);
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [hasStripe, setHasStripe] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userEmail = user?.email || "";
      setEmail(userEmail);

      if (!userEmail || !user?.id) {
        setLoading(false);
        return;
      }

      const [{ data: requests }, { data: liveCampaigns }, { data: liveAds }, { data: tracking }, { data: payouts }, { data: profile }] =
        await Promise.all([
          (supabase as any)
            .from("affiliate_requests")
            .select("offer_id,status,created_at")
            .eq("affiliate_email", userEmail)
            .order("created_at", { ascending: false }),
          (supabase as any)
            .from("live_campaigns")
            .select("id")
            .eq("affiliate_email", userEmail)
            .limit(1),
          (supabase as any)
            .from("live_ads")
            .select("id")
            .eq("affiliate_email", userEmail)
            .limit(1),
          (supabase as any)
            .from("campaign_tracking_events")
            .select("id")
            .eq("affiliate_id", userEmail)
            .in("event_type", ["click", "landing_view", "page_view"])
            .limit(1),
          (supabase as any)
            .from("wallet_payouts")
            .select("amount,status")
            .eq("affiliate_email", userEmail),
          (supabase as any)
            .from("profiles")
            .select("stripe_account_id")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

      const reqRows = requests || [];
      setRequested(reqRows.length > 0);

      const approved = reqRows.find((r: any) => r.status === "approved");
      const approvedId = approved?.offer_id || null;
      setApprovedOfferId(approvedId);

      if (approvedId) {
        const { data: offer } = await (supabase as any)
          .from("offers")
          .select("id,title")
          .eq("id", approvedId)
          .maybeSingle();
        setApprovedOfferName((offer as OfferRow | null)?.title || "Your approved offer");
      }

      setLaunchedCampaign(Boolean((liveCampaigns || []).length || (liveAds || []).length));
      setFirstClick(Boolean((tracking || []).length));

      const payoutAmount = (payouts || []).reduce((sum: number, row: any) => {
        const val = Number(row.amount || 0);
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0);
      setCommissionTotal(payoutAmount);

      setHasStripe(Boolean((profile as any)?.stripe_account_id));
      setLoading(false);
    };

    void load();
  }, []);

  const checklist = useMemo(
    () => [
      { label: "Create Account", done: true },
      { label: "Request First Offer", done: requested },
      { label: "Get Approved", done: Boolean(approvedOfferId) },
      { label: "Launch First Campaign", done: launchedCampaign },
      { label: "Generate First Click", done: firstClick },
      { label: "Earn First Commission", done: commissionTotal > 0 },
    ],
    [requested, approvedOfferId, launchedCampaign, firstClick, commissionTotal],
  );

  const completed = checklist.filter((x) => x.done).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05080b] p-8 text-white">
        <p className="text-sm text-white/70">Loading dashboard…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05080b] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-[#0b1015] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/50">Affiliate Dashboard V1</p>
          <h1 className="mt-2 text-3xl font-semibold">Activation checklist</h1>
          <p className="mt-2 text-sm text-white/70">Progress: {completed}/{checklist.length}</p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#00C2CB]"
              style={{ width: `${(completed / checklist.length) * 100}%` }}
            />
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-[#0b1015] p-6">
          <ul className="space-y-3 text-sm">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                <span>{item.done ? "✅" : "⬜"}</span>
                <span className={item.done ? "text-white" : "text-white/65"}>{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {approvedOfferId && (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6">
            <p className="text-lg font-semibold">🎉 Approved To Promote</p>
            <p className="mt-2 text-sm text-emerald-100">Offer: {approvedOfferName}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/affiliate/internal/paid-launch/${approvedOfferId}`}
                className="rounded-xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
              >
                Launch Campaign
              </Link>
              <Link
                href={`/affiliate/internal/organic/${approvedOfferId}`}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/5"
              >
                Promote Organically
              </Link>
            </div>
          </section>
        )}

        {commissionTotal > 0 && !hasStripe && (
          <section className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6">
            <p className="text-lg font-semibold">Connect Stripe To Receive Earnings</p>
            <p className="mt-2 text-sm text-amber-100">
              Pending payout available: {formatCurrency(commissionTotal)}
            </p>
            <Link
              href="/affiliate/settings#withdrawals"
              className="mt-4 inline-flex rounded-xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
            >
              Connect Stripe
            </Link>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-[#0b1015] p-6 text-sm text-white/75">
          Signed in as: {email || "Unknown"}
        </section>
      </div>
    </main>
  );
}
