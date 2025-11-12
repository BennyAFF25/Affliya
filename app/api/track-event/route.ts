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
      // 1) Try resolve via ad_ideas (primary source)
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
          console.warn('[track-event] offer_id not provided; fallback resolution failed', { campaign_id, adErr, liveErr });
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
        .select('business_email, commission_type, commission_value')
        .eq('id', inserted.offer_id)
        .maybeSingle();

      if (!offerErr && offer?.business_email) {
        const type = (offer.commission_type || 'percent').toLowerCase();
        const val = Number(offer.commission_value ?? 0);
        let affiliatePayout = 0;

        affiliatePayout =
          type === 'flat'
            ? val
            : Math.round((inserted.amount * val) / 100 * 100) / 100;

        const { error: payoutErr } = await supabase
          .from('wallet_payouts')
          .upsert(
            {
              business_email: offer.business_email,
              affiliate_email: inserted.affiliate_id,
              offer_id: inserted.offer_id,
              amount: affiliatePayout,
              status: 'pending',
              source_event_id: inserted.id,
            },
            { onConflict: 'source_event_id' }
          );

        if (payoutErr) console.error('[track-event] wallet_payouts upsert error', payoutErr);
      } else {
        console.warn('[track-event] offer lookup failed; skipping payout insert', { offerErr });
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