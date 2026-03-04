'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { supabase } from '@/../utils/supabase/pages-client';

interface ShopRow {
  offer_id: string;
  custom_image_url: string | null;
  custom_price: string | null;
  custom_description: string | null;
  display_order: number | null;
}

interface OfferRow {
  id: string;
  title: string;
  description: string | null;
  logo_url: string | null;
}

export default function MyShopPage() {
  const { session } = useSessionContext();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ShopRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const username = (session?.user?.user_metadata as any)?.username;
  const shopLink = username ? `https://www.nettmark.com/shop/${username}` : null;

  useEffect(() => {
    if (!session?.user?.email) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data: approved } = await supabase
          .from('affiliate_requests')
          .select('offer_id')
          .eq('affiliate_email', session.user.email)
          .eq('status', 'approved');

        const offerIds = approved?.map((row) => row.offer_id) || [];

        if (offerIds.length === 0) {
          setOffers([]);
          setOverrides({});
          return;
        }

        const { data: offerRows } = await supabase
          .from('offers')
          .select('id, title, description, logo_url')
          .in('id', offerIds);

        const { data: overrideRows } = await supabase
          .from('affiliate_shop_items')
          .select('offer_id, custom_image_url, custom_price, custom_description, display_order')
          .eq('affiliate_email', session.user.email)
          .in('offer_id', offerIds);

        const overrideMap: Record<string, ShopRow> = {};
        overrideRows?.forEach((row) => {
          overrideMap[row.offer_id] = row;
        });

        setOffers((offerRows || []) as OfferRow[]);
        setOverrides(overrideMap);
      } catch (err: any) {
        console.error('[MyShop] load failed', err);
        setError('Failed to load shop data.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [session?.user?.email]);

  const rows = useMemo(() => {
    return offers
      .map((offer) => ({
        offer,
        override: overrides[offer.id],
      }))
      .sort((a, b) => {
        const orderA = a.override?.display_order ?? 0;
        const orderB = b.override?.display_order ?? 0;
        return orderA - orderB || a.offer.title.localeCompare(b.offer.title);
      });
  }, [offers, overrides]);

  const updateOverride = (offerId: string, patch: Partial<ShopRow>) => {
    setOverrides((prev) => ({
      ...prev,
      [offerId]: {
        offer_id: offerId,
        custom_image_url: prev[offerId]?.custom_image_url ?? null,
        custom_price: prev[offerId]?.custom_price ?? null,
        custom_description: prev[offerId]?.custom_description ?? null,
        display_order: prev[offerId]?.display_order ?? 0,
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    if (!session?.user) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const items = Object.values(overrides);
      const res = await fetch('/api/affiliate-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Save failed');
      }

      setMessage('Shop updated');
    } catch (err: any) {
      console.error('[MyShop] save failed', err);
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!shopLink) return;
    try {
      await navigator.clipboard.writeText(shopLink);
      setMessage('Link copied');
    } catch (err) {
      setError('Copy failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface text-white p-6">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-white px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">NettmarkShop</p>
            <h1 className="text-3xl font-bold">My Shop</h1>
          </div>
          {shopLink && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-xs text-white/60 break-all">{shopLink}</span>
              <button
                onClick={copyLink}
                className="rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
              >
                Copy link
              </button>
            </div>
          )}
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
            {message}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/70">
            No approved offers yet. Once a business approves you, the offers will appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map(({ offer, override }) => (
              <div
                key={offer.id}
                className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-4 sm:flex-row"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{offer.title}</h3>
                  <p className="text-sm text-white/60">
                    {offer.description || 'No description yet.'}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-white/50">
                      Image URL
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={override?.custom_image_url ?? ''}
                        onChange={(e) => updateOverride(offer.id, { custom_image_url: e.target.value })}
                        placeholder={offer.logo_url || 'https://…'}
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      Price label
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={override?.custom_price ?? ''}
                        onChange={(e) => updateOverride(offer.id, { custom_price: e.target.value })}
                        placeholder="$49.00"
                      />
                    </label>
                    <label className="text-xs text-white/50 sm:col-span-2">
                      Short description
                      <textarea
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={override?.custom_description ?? ''}
                        onChange={(e) => updateOverride(offer.id, { custom_description: e.target.value })}
                        rows={2}
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      Display order
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={override?.display_order ?? 0}
                        onChange={(e) => updateOverride(offer.id, { display_order: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-[#00C2CB] px-6 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save shop'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
