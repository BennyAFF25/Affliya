import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toNum(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractAmountAndCurrency(data: any): { amount: number | null; currency: string | null } {
  if (!data || typeof data !== 'object') return { amount: null, currency: null };

  let amount: number | null = null;
  let currency: string | null = null;

  // 1) Shopify style: totalPrice: { amount, currencyCode }
  if (data.totalPrice) {
    amount = toNum(data.totalPrice.amount);
    if (typeof data.totalPrice.currencyCode === 'string') {
      currency = data.totalPrice.currencyCode.toLowerCase();
    }
  }

  // 2) Common direct fields
  if (amount == null) {
    const candidates = [
      data.amount,
      data.total,
      data.value,
      data.price,
      data.order_total,
      data.total_price,
      data.current_total_price,
      data.subtotal_price,
      data.total_line_items_price,
    ];
    for (const c of candidates) {
      const n = toNum(c);
      if (n != null) {
        amount = n;
        break;
      }
    }
  }

  if (!currency) {
    const currencyCandidates = [
      data.currency,
      data.currencyCode,
      data?.totalPrice?.currencyCode,
    ];
    for (const cur of currencyCandidates) {
      if (typeof cur === 'string' && cur.trim()) {
        currency = cur.toLowerCase();
        break;
      }
    }
  }

  return { amount, currency };
}

function hostnameFrom(event_data: any, fallbackRef?: string | null): string | null {
  try {
    const raw = (event_data?.url || event_data?.page_url || event_data?.location || fallbackRef || '').toString();
    if (!raw) return null;
    const h = new URL(raw).hostname.toLowerCase();
    return h.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Support both JSON and text/plain from sendBeacon/fetch
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else {
      const text = await req.text();
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    const event_type = body.event_type;
    if (!event_type) {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 });
    }

    const affiliate_id = body.affiliate_id ?? null;
    const campaign_id = body.campaign_id ?? null;
    let offer_id = body.offer_id ?? body?.event_data?.offer_id ?? null;

    const raw_event_data = body.event_data;
    const event_data =
      raw_event_data && typeof raw_event_data === 'object'
        ? raw_event_data
        : {};

    // --- Offer ID Fallback Logic ---
    if (!offer_id && campaign_id) {
      // 0) PRIMARY: resolve via live_campaigns (authoritative mapping from runtime campaign → offer)
      const { data: liveCamp, error: liveCampErr } = await supabase
        .from('live_campaigns')
        .select('offer_id')
        .eq('id', campaign_id)
        .maybeSingle();

      if (!liveCampErr && liveCamp?.offer_id) {
        offer_id = liveCamp.offer_id;
        console.log(`[track-event] [fallback] offer_id via live_campaigns → ${offer_id}`);
      } else {
        // 1) Try resolve via ad_ideas (older path for campaigns created from ad ideas)
        const { data: adIdea, error: adErr } = await supabase
          .from('ad_ideas')
          .select('offer_id')
          .eq('campaign_id', campaign_id)
          .maybeSingle();

        if (!adErr && adIdea?.offer_id) {
          offer_id = adIdea.offer_id;
          console.log(`[track-event] [fallback] offer_id via ad_ideas → ${offer_id}`);
        } else {
          // 2) Secondary fallback via live_ads if present
          const { data: liveAd, error: liveErr } = await supabase
            .from('live_ads')
            .select('offer_id')
            .eq('campaign_id', campaign_id)
            .maybeSingle();

          if (!liveErr && liveAd?.offer_id) {
            offer_id = liveAd.offer_id;
            console.log(`[track-event] [fallback] offer_id via live_ads → ${offer_id}`);
          } else {
            // 3) Tertiary fallback via organic_posts if present
            const { data: organicPost, error: organicErr } = await supabase
              .from('organic_posts')
              .select('offer_id')
              .eq('campaign_id', campaign_id)
              .maybeSingle();

            if (!organicErr && organicPost?.offer_id) {
              offer_id = organicPost.offer_id;
              console.log(`[track-event] [fallback] offer_id via organic_posts → ${offer_id}`);
            } else {
              // 4) Final fallback: infer by hostname against offers.site_host
              const host = hostnameFrom(event_data, body?.referrer || null);
              if (host) {
                const { data: offerByHost, error: hostErr } = await supabase
                  .from('offers')
                  .select('id, site_host')
                  .ilike('site_host', `%${host}%`)
                  .maybeSingle();

                if (!hostErr && offerByHost?.id) {
                  offer_id = offerByHost.id;
                  console.log(`[track-event] [fallback] offer_id via offers.site_host (${offerByHost.site_host}) → ${offer_id}`);
                } else {
                  console.warn('[track-event] offer_id not provided; all fallbacks failed', {
                    campaign_id,
                    host,
                    liveCampErr,
                    adErr,
                    liveErr,
                    organicErr,
                    hostErr,
                  });
                }
              } else {
                console.warn('[track-event] offer_id not provided; no hostname available and all fallbacks failed', {
                  campaign_id,
                  liveCampErr,
                  adErr,
                  liveErr,
                  organicErr,
                });
              }
            }
          }
        }
      }
    }

    const { amount, currency } = extractAmountAndCurrency(event_data);

    // Insert into campaign_tracking_events
    const { data: insertedRows, error: insertErr } = await supabase
      .from('campaign_tracking_events')
      .insert([{
        event_type,
        affiliate_id,
        campaign_id,
        offer_id,
        event_data,
        amount,
        currency,
        ip_address:
          req.headers.get('x-forwarded-for') ||
          req.headers.get('X-Real-IP') ||
          null,
        user_agent: req.headers.get('user-agent') || null,
      }])
      .select('id, event_type, affiliate_id, campaign_id, offer_id, amount');

    if (insertErr || !insertedRows || !insertedRows[0]) {
      console.error('[track-event] insert error', insertErr);
      return NextResponse.json({ ok: false, error: 'db_insert_failed' }, { status: 500 });
    }

    const inserted = insertedRows[0];

    // --- Auto-create wallet payout if it's a conversion ---
    if (
      inserted.event_type === 'conversion' &&
      inserted.amount &&
      inserted.offer_id &&
      inserted.affiliate_id
    ) {
      const { data: offer, error: offerErr } = await supabase
        .from('offers')
        .select('business_email, commission_value, commission')
        .eq('id', inserted.offer_id)
        .maybeSingle();

      if (!offerErr && offer?.business_email) {
        // Use commission_value as percent; fall back to legacy `commission`
        const pctRaw = offer.commission_value ?? offer.commission ?? 0;
        const pct = Number(pctRaw);
        const base = Number(inserted.amount ?? 0);
        // Guard
        if (!Number.isFinite(pct) || !Number.isFinite(base)) {
          console.warn('[track-event] invalid pct/base for payout', { pctRaw, pct, base });
        }
        // Percent of sale, rounded to 2 decimals
        const affiliatePayoutRaw = (base * pct) / 100;
        const affiliatePayoutFixed = Math.round(affiliatePayoutRaw * 100) / 100; // 2dp

        // Check if we already created a payout for this event
        const { data: existingPayout, error: existingErr } = await supabase
          .from('wallet_payouts')
          .select('id')
          .eq('source_event_id', inserted.id)
          .maybeSingle();

        if (existingErr) {
          console.error('[track-event] existing payout lookup error', existingErr);
        }

        if (!existingPayout) {
          const { error: payoutErr } = await supabase
            .from('wallet_payouts')
            .insert({
              business_email: offer.business_email,
              affiliate_email: inserted.affiliate_id,
              offer_id: inserted.offer_id,
              amount: affiliatePayoutFixed,
              status: 'pending',
              source_event_id: inserted.id,
            });

          if (payoutErr) {
            console.error('[track-event] wallet_payouts insert error', payoutErr);
          } else {
            console.log('[track-event] wallet_payouts insert OK', {
              event_id: inserted.id,
              amount: affiliatePayoutFixed,
              business_email: offer.business_email,
              affiliate_email: inserted.affiliate_id,
              offer_id: inserted.offer_id,
            });
          }
        } else {
          console.log('[track-event] wallet_payouts exists, skipping insert', { event_id: inserted.id, payout_id: existingPayout.id });
        }
      } else {
        console.warn('[track-event] offer lookup failed; skipping payout insert', { offerErr, offer_id: inserted.offer_id });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[track-event] unhandled error', e);
    return NextResponse.json(
      { ok: false, error: 'unhandled' },
      { status: 500 }
    );
  }
}