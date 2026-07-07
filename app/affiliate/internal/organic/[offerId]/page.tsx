"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";

export default function OrganicPromotionPage() {
  const params = useParams();
  const offerId = params.offerId as string;
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email || "");
    };
    void run();
  }, []);

  const trackingLink = useMemo(() => {
    if (!email) return "";
    return `https://www.nettmark.com/go/${offerId}___${email}`;
  }, [offerId, email]);

  return (
    <main className="min-h-screen bg-[#05080b] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0b1015] p-6">
        <h1 className="text-2xl font-semibold">Organic Promotion Flow</h1>
        <p className="mt-2 text-sm text-white/70">Can be used immediately. No wallet required.</p>

        <section className="mt-5 rounded-2xl border border-white/12 bg-white/[0.03] p-4">
          <h2 className="text-sm font-semibold text-[#7ff5fb]">Tracking link</h2>
          <p className="mt-2 break-all text-xs text-white/80">{trackingLink || "Loading…"}</p>
          <button
            onClick={async () => {
              if (!trackingLink) return;
              await navigator.clipboard.writeText(trackingLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="mt-3 rounded-lg bg-[#00C2CB] px-3 py-2 text-xs font-semibold text-black"
          >
            {copied ? "Copied" : "Get Tracking Link"}
          </button>
        </section>

        <section className="mt-4 rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-sm text-white/75">
          <p className="font-semibold text-white">Creator instructions</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Use your tracking link in bio/caption or CTA block.</li>
            <li>Disclose affiliate promotion where required.</li>
            <li>Follow brand offer rules and claims policy.</li>
          </ul>
          <p className="mt-3 font-semibold text-white">Allowed platforms</p>
          <p className="mt-1 text-white/70">TikTok, Instagram, YouTube, Facebook, X, Email newsletters, Blogs.</p>
        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={async () => {
              if (!trackingLink) return;
              await navigator.clipboard.writeText(trackingLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="rounded-xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
          >
            Get Tracking Link
          </button>
          <Link
            href={`/affiliate/dashboard/promote/${offerId}?mode=organic`}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/5"
          >
            Submit Content
          </Link>
        </div>
      </div>
    </main>
  );
}
