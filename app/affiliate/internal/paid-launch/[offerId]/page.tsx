"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/../utils/supabase/pages-client";
import { calculateWalletBalance } from "@/../utils/wallet/balance";

export default function PaidLaunchGatePage() {
  const params = useParams();
  const offerId = params.offerId as string;
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWallet = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;
      if (!email) {
        setLoading(false);
        return;
      }

      const { data: topups } = await (supabase as any)
        .from("wallet_topups")
        .select("amount_net, credited_amount, amount_refunded, status")
        .eq("affiliate_email", email);

      const { data: deductions } = await (supabase as any)
        .from("wallet_deductions")
        .select("amount")
        .eq("affiliate_email", email);

      const snapshot = calculateWalletBalance({
        topups: topups || [],
        deductions: deductions || [],
      });

      setWalletBalance(snapshot.availableBalance || 0);
      setLoading(false);
    };

    void loadWallet();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05080b] p-8 text-white">
        <p className="text-sm text-white/70">Checking wallet…</p>
      </main>
    );
  }

  const hasFunds = walletBalance > 0;

  return (
    <main className="min-h-screen bg-[#05080b] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b1015] p-6">
        <h1 className="text-2xl font-semibold">Paid Campaign Flow</h1>

        {!hasFunds ? (
          <section className="mt-5 space-y-4">
            <p className="text-white/85">Ad campaigns require wallet funds.</p>
            <p className="text-sm text-white/65">Wallet funds are used only for ad spend.</p>
            <Link
              href="/affiliate/wallet"
              className="inline-flex rounded-xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
            >
              Top Up Wallet
            </Link>
          </section>
        ) : (
          <section className="mt-5 space-y-4">
            <p className="text-sm text-[#7ff5fb]">Wallet balance detected. You can continue.</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-white/75">
              <li>Create Campaign</li>
              <li>Create Ad</li>
              <li>Submit Ad Idea</li>
              <li>Launch</li>
            </ol>
            <Link
              href={`/affiliate/dashboard/promote/${offerId}?mode=ad`}
              className="inline-flex rounded-xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
            >
              Continue to Create Campaign
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
