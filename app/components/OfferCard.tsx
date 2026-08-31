'use client';

import { useSession } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeDollarSign, ShoppingBag, TrendingUp, Globe, ArrowUpRight } from 'lucide-react';

interface Offer {
  id: string;
  businessName?: string;
  description: string;
  commission: number;
  type: string;
  price?: number;
  currency?: string;
  commissionValue?: number;
  isTopCommission?: boolean;
  businessEmail?: string;
  business_email?: string;
  logoUrl?: string;
  website?: string;
  meta_page_id?: string | null;
  meta_ad_account_id?: string | null;
  meta_pixel_id?: string | null;
  starterCreditAmount?: number;
  readyCreativeCount?: number;
  readyOrganicCreativeCount?: number;
  readyPaidCreativeCount?: number;
}

function getPromotionMode(offer: Offer) {
  const adsEnabled = !!offer.meta_page_id && !!offer.meta_ad_account_id;
  if (adsEnabled) {
    return {
      label: "Ads enabled",
      tone: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40",
      helper: "Organic + paid ads available",
    };
  }

  return {
    label: "Organic only",
    tone: "bg-white/5 text-white/75 border border-white/10",
    helper: "Paid ads unlock once Meta is connected",
  };
}

function formatMoney(amount: number, currency?: string) {
  const normalizedCurrency = (currency || 'USD').toUpperCase();

  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${normalizedCurrency} ${amount.toFixed(2)}`;
  }
}

function getOfferTags(offer: Offer) {
  const tags = [offer.type === 'recurring' ? 'Recurring' : 'One-time'];

  if (offer.meta_page_id && offer.meta_ad_account_id) {
    tags.push('Paid ads');
  } else {
    tags.push('Organic');
  }

  if (offer.meta_pixel_id) {
    tags.push('Tracking ready');
  }

  return tags;
}

export default function OfferCard({
  offer,
  role,
  alreadyRequested = false,
}: {
  offer: Offer;
  role: 'business' | 'affiliate';
  alreadyRequested?: boolean;
}) {
  const session = useSession();
  const user = session?.user;
  const [requested, setRequested] = useState(alreadyRequested);
  const [starting, setStarting] = useState(false);
  const router = useRouter();
  const promotionMode = getPromotionMode(offer);
  const offerTags = useMemo(() => getOfferTags(offer), [offer]);
  const formattedPrice = offer.price ? formatMoney(offer.price, offer.currency) : null;
  const estimatedPayout = offer.commissionValue ?? (offer.price ? (offer.price * offer.commission) / 100 : null);
  const payoutLabel = offer.type === 'recurring' ? 'Recurring payout' : 'Est. payout per sale';
  const approvalLabel = offer.meta_pixel_id ? 'Review ready' : 'Manual review';
  const fitSummary = offer.meta_page_id && offer.meta_ad_account_id
    ? 'Built for both organic placements and paid Meta campaigns.'
    : 'Best suited to organic content, link-in-bio placements, and creator-led promotion.';
  const readyCreativeLabel = offer.readyCreativeCount && offer.readyCreativeCount > 0
    ? `${offer.readyCreativeCount} ready-to-use creative${offer.readyCreativeCount === 1 ? '' : 's'}`
    : null;

  const startPromoting = async () => {
    if (!user?.email) {
      alert('You must be logged in to start promoting.');
      return;
    }

    setStarting(true);
    try {
      const res = await fetch(`/api/affiliate/offers/${offer.id}/start`, {
        method: 'POST',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        alert(json?.message || json?.error || 'Failed to start promoting this offer.');
        return;
      }

      setRequested(true);
      router.push(json.promotePath || `/affiliate/dashboard/promote/${offer.id}`);
    } catch (e) {
      console.warn('[offer-start] failed', e);
      alert('Failed to start promoting this offer.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-[#1f2937] bg-[#101010] px-5 py-5 shadow-md transition-all duration-200 hover:border-[#00C2CB]/80 hover:shadow-[0_0_35px_rgba(0,194,203,0.18)]">
      {offer.currency && (
        <div className="absolute right-4 top-4 rounded-full border border-[#00C2CB]/40 bg-[#0b1726] px-3 py-1 text-[11px] font-medium text-[#00C2CB]">
          {offer.currency}
        </div>
      )}

      <div className="mb-5 flex items-start justify-between gap-3 pr-16">
        <div className="flex items-start gap-3">
          {offer.logoUrl ? (
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <img
                src={offer.logoUrl}
                alt="Business Logo"
                className="h-full w-full object-contain p-2"
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C2CB]/12 text-sm font-semibold text-[#7ff5fb]">
              {(offer.businessName || 'O').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Offer</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {offer.businessName}
            </h2>
            <p className="mt-1 text-xs text-gray-500">Built for affiliate growth</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] text-emerald-300">
            ● Verified
          </span>
          {offer.isTopCommission && (
            <div className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 px-2 py-0.5 text-[11px] text-amber-200">
              <TrendingUp className="h-3.5 w-3.5" />
              Top payout
            </div>
          )}
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(0,194,203,0.10),rgba(255,255,255,0.02))] p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#7ff5fb]/80">Primary payout</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-bold tracking-tight text-[#7ff5fb]">{offer.commission}%</p>
            <p className="mt-1 text-sm text-white/75">{offer.type === 'recurring' ? 'Recurring commission' : 'Commission per conversion'}</p>
          </div>
          {estimatedPayout ? (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{payoutLabel}</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatMoney(estimatedPayout, offer.currency)}</p>
            </div>
          ) : null}
        </div>
        {formattedPrice ? (
          <p className="mt-3 text-xs text-white/55">Based on a typical order value of {formattedPrice}.</p>
        ) : null}
      </div>

      <p className="mb-4 line-clamp-3 text-sm leading-6 text-gray-400">
        {offer.description}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${promotionMode.tone}`}>
          {promotionMode.label}
        </span>
        {offer.starterCreditAmount ? (
          <span className="inline-flex items-center rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-2.5 py-1 text-[11px] font-medium text-[#7ff5fb]">
            Includes ${offer.starterCreditAmount.toFixed(0)} starter ad spend
          </span>
        ) : null}
        {readyCreativeLabel ? (
          <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
            {readyCreativeLabel}
          </span>
        ) : null}
        {offerTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-gray-400">
            <BadgeDollarSign className="h-4 w-4 text-[#00C2CB]" />
            <span className="text-[11px] uppercase tracking-wide">Payout</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">{offer.commission}% {offer.type === 'recurring' ? 'recurring' : 'sale'}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-gray-400">
            <ShoppingBag className="h-4 w-4 text-sky-400" />
            <span className="text-[11px] uppercase tracking-wide">Review</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">{approvalLabel}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Globe className="h-4 w-4 text-emerald-400" />
            <span className="text-[11px] uppercase tracking-wide">Channel</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">{promotionMode.label}</p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Best fit</p>
        <p className="mt-2 text-sm text-white/72">{fitSummary}</p>
        {offer.website ? (
          <a
            href={offer.website}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#7ff5fb] hover:text-[#9bf8fc]"
          >
            Visit brand site <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="mt-3 text-xs text-gray-500">{promotionMode.helper}</p>
        )}
        {readyCreativeLabel ? (
          <p className="mt-3 text-xs text-emerald-200/85">
            {offer.readyPaidCreativeCount ? `${offer.readyPaidCreativeCount} paid` : '0 paid'} · {offer.readyOrganicCreativeCount ? `${offer.readyOrganicCreativeCount} organic` : '0 organic'} brand assets ready to drop into Start promoting.
          </p>
        ) : null}
      </div>

      {/* Footer buttons */}
      <div className="mt-5 flex gap-3">
        {role === 'affiliate' ? (
          <>
            <Link
              href={`/affiliate/marketplace/${offer.id}`}
              className="flex-1 text-center rounded-lg border border-[#00C2CB] px-4 py-2 text-xs sm:text-sm font-medium text-[#00C2CB] hover:bg-[#00C2CB]/10 transition-colors"
            >
              View offer
            </Link>
            <button
              onClick={startPromoting}
              disabled={starting}
              className={`flex-1 font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                starting
                  ? 'bg-zinc-700 text-gray-300 cursor-wait'
                  : 'bg-[#00C2CB] hover:bg-[#00b0b8] text-black'
              }`}
            >
              {starting ? 'Opening…' : requested ? 'Continue Promoting' : 'Start Promoting'}
            </button>
          </>
        ) : (
          <Link href={`/business/my-business/edit-offer/${offer.id}`}>
            <button className="w-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-colors">
              View Details
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}
