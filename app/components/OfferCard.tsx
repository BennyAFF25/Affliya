'use client';

import React from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  Image as ImageIcon,
  TrendingUp,
} from 'lucide-react';

interface Offer {
  id: string;
  businessName?: string;
  title?: string;
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
  participationMode?: 'open' | 'approval_required' | 'private';
}

function getPromotionMode(offer: Offer) {
  const adsEnabled = !!offer.meta_page_id && !!offer.meta_ad_account_id;
  if (adsEnabled) {
    return {
      label: 'Ads enabled',
      tone: 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
      helper: 'Organic + paid ads available',
    };
  }

  return {
    label: 'Organic only',
    tone: 'border border-white/10 bg-white/5 text-white/75',
    helper: 'Paid ads unlock once Meta is connected',
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

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'info' | 'warning';
}) {
  const styles = {
    neutral: 'border-white/10 bg-white/[0.03] text-zinc-300',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    info: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
    warning: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  } as const;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

export default function OfferCard({
  offer,
  role,
  alreadyRequested = false,
  currentStatus,
}: {
  offer: Offer;
  role: 'business' | 'affiliate';
  alreadyRequested?: boolean;
  currentStatus?: 'approved' | 'pending' | 'rejected' | null;
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
  const payoutLabel = offer.type === 'recurring' ? 'Recurring payout' : 'Est. payout';
  const readyCreativeLabel = offer.readyCreativeCount && offer.readyCreativeCount > 0
    ? `${offer.readyCreativeCount} ready creative${offer.readyCreativeCount === 1 ? '' : 's'}`
    : null;
  const participationMode = offer.participationMode || 'open';
  const isPrivate = participationMode === 'private';
  const isPending = currentStatus === 'pending';
  const isApproved = currentStatus === 'approved';
  const canStart = !isPrivate && currentStatus !== 'pending';

  const name = offer.businessName || offer.title || 'Untitled offer';
  const logoFallback = name.slice(0, 1).toUpperCase();
  const subtitle = readyCreativeLabel || promotionMode.helper;
  const channelLabel = offer.meta_page_id && offer.meta_ad_account_id ? 'Paid + organic' : 'Organic only';

  const commissionHeadline =
    offer.commission > 0
      ? `${offer.commission}%`
      : estimatedPayout != null
        ? formatMoney(estimatedPayout, offer.currency)
        : 'Custom';

  const commissionSubtext =
    offer.commission > 0
      ? offer.type === 'recurring'
        ? 'Recurring commission'
        : 'Per conversion'
      : offer.type === 'recurring'
        ? 'Recurring payout'
        : 'Fixed payout';

  const primaryLabel = starting
    ? 'Opening…'
    : isPrivate
      ? 'Private offer'
      : isPending
        ? 'Pending Approval'
        : requested || isApproved
          ? 'Continue Promoting'
          : participationMode === 'approval_required'
            ? 'Request to Promote'
            : 'Start Promoting';

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
      if (json.promotePath) {
        router.push(json.promotePath || `/affiliate/dashboard/promote/${offer.id}`);
      }
    } catch (e) {
      console.warn('[offer-start] failed', e);
      alert('Failed to start promoting this offer.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-[var(--sidebar-border)] bg-[var(--sidebar)] text-white shadow-[0_10px_24px_rgba(0,0,0,0.20)] transition hover:border-cyan-400/35 hover:shadow-[0_14px_34px_rgba(0,194,203,0.08)]">
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:min-h-[420px]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            {offer.logoUrl ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <img src={offer.logoUrl} alt={`${name} logo`} className="h-full w-full object-contain p-2" />
              </div>
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--sidebar-border)] bg-[#202329] text-sm font-semibold text-cyan-200">
                {logoFallback}
              </div>
            )}

            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                <span>Verified</span>
                <BadgeCheck className="h-4 w-4 fill-emerald-400 text-[#111416]" />
                {offer.isTopCommission ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] tracking-normal text-amber-200">
                    <TrendingUp className="h-3 w-3" />
                    Top payout
                  </span>
                ) : null}
              </div>
              <h2 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                {name}
              </h2>
              <p className="mt-1 truncate text-sm text-zinc-500">{subtitle}</p>
            </div>
          </div>

          {offer.currency ? (
            <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/[0.05] px-3 py-1 text-[11px] font-semibold text-cyan-300">
              {String(offer.currency).toUpperCase()}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-2xl border border-[var(--sidebar-border)] bg-[#202329] p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Commission</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-cyan-300">{commissionHeadline}</p>
            <p className="mt-1 text-xs text-zinc-500">{commissionSubtext}</p>
          </div>

          {estimatedPayout != null ? (
            <div className="min-w-0 border-white/10 sm:border-l sm:pl-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{payoutLabel}</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatMoney(estimatedPayout, offer.currency)}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {offer.type === 'recurring' ? 'Per billing cycle' : 'Typical conversion payout'}
              </p>
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}

          <div className="min-w-0 border-white/10 sm:border-l sm:pl-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Payout basis</p>
            <p className="mt-1 text-sm leading-5 text-zinc-400">
              {formattedPrice ? `Based on a typical order value of ${formattedPrice}.` : 'Payout details are shown once enough offer data is available.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill tone={offer.meta_page_id && offer.meta_ad_account_id ? 'success' : 'neutral'}>
            {promotionMode.label}
          </StatusPill>
          <StatusPill>{offer.type === 'recurring' ? 'Recurring' : 'One-time'}</StatusPill>
          <StatusPill>{channelLabel}</StatusPill>
          {offer.meta_pixel_id ? <StatusPill tone="info">Tracking ready</StatusPill> : null}
          {participationMode === 'approval_required' ? <StatusPill tone="warning">Approval required</StatusPill> : null}
          {isPending ? <StatusPill tone="warning">Pending affiliate</StatusPill> : null}
          {offer.starterCreditAmount ? (
            <StatusPill tone="info">Includes ${offer.starterCreditAmount.toFixed(0)} starter ad spend</StatusPill>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 lg:flex-1 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--sidebar-border)] bg-[#202329] text-zinc-500">
              {offer.logoUrl ? (
                <img src={offer.logoUrl} alt="Offer preview" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-3 text-sm leading-6 text-zinc-300">
                {offer.description || 'No description added for this offer yet.'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                {readyCreativeLabel ? <span>{readyCreativeLabel}</span> : null}
                {!readyCreativeLabel && offerTags.length > 0 ? <span>{offerTags.join(' · ')}</span> : null}
              </div>
            </div>
          </div>

          {offer.website ? (
            <a
              href={offer.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-cyan-300 hover:text-cyan-200"
            >
              Visit brand site
              <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : null}
        </div>

        <div className="mt-auto grid gap-3 pt-1 sm:grid-cols-2">
          {role === 'affiliate' ? (
            <>
              <Link
                href={`/affiliate/marketplace/${offer.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-400/40 hover:text-white"
              >
                View offer
              </Link>
              <button
                onClick={startPromoting}
                disabled={starting || !canStart}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  starting || !canStart
                    ? 'cursor-wait bg-zinc-700 text-gray-300'
                    : 'bg-cyan-400 text-[#051114] hover:bg-cyan-300'
                }`}
              >
                {primaryLabel}
                {!starting && canStart ? <ChevronRight className="h-4 w-4" /> : null}
              </button>
            </>
          ) : (
            <Link
              href={`/business/my-business/edit-offer/${offer.id}`}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-[#051114] transition hover:bg-cyan-300 sm:col-span-2"
            >
              View Details
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
