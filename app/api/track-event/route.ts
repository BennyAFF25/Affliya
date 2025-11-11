// app/api/track-event/route.ts
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

function extractAmountAndCurrency(event_data: any): { amount: number | null; currency: string | null } {
  let amount: number | null = null;
  let currency: string | null = null;

  if (event_data && typeof event_data === 'object') {
    // Shopify moneyV2 style
    amount ??= toNum(event_data?.totalPrice?.amount);
    if (!currency && typeof event_data?.totalPrice?.currencyCode === 'string') {
      currency = event_data.totalPrice.currencyCode.toLowerCase();
    }

    // Common keys
    const amountCandidates = [
      event_data.amount,
      event_data.total,
      event_data.value,
      event_data.price,
      event_data.order_total,
      event_data.total_price,
      event_data.current_total_price,
      event_data.subtotal_price,
      event_data.total_line_items_price,
      event_data?.order?.current_total_price,
      event_data?.checkout?.totalPrice?.amount,
    ];
    for (const c of amountCandidates) {
      const n = toNum(c);
      if (n != null) {
        amount = n;
        break;
      }
    }

    const currencyCandidates = [
      event_data.currency,
      event_data.currencyCode,
      event_data?.totalPrice?.currencyCode,
      event_data?.checkout?.totalPrice?.currencyCode,
      event_data?.order?.presentment_currency,
    ];
    for (const cur of currencyCandidates) {
      if (!currency && typeof cur === 'string' && cur.trim()) {
        currency = cur.toLowerCase();
        break;
      }
    }

    // Fallback from line items
    if (amount == null) {
      const items =
        event_data.line_items ||
        event_data?.order?.line_items ||
        event_data?.checkout?.lineItems ||
        [];
      if (Array.isArray(items) && items.length) {
        const sum = items.reduce((acc: number, li: any) => {
          const qty = toNum(li?.quantity) ?? 1;
          const unit =
            toNum(li?.price?.amount) ??
            toNum(li?.price) ??
            toNum(li?.variant?.price?.amount) ??
            0;
          return acc + (qty || 1) * (unit || 0);
        }, 0);
        if (sum > 0) amount = sum;
      }
    }
  }

  return { amount, currency };
}

export async function POST(req: NextRequest) {
  try {
    // Pixel sends text/plain (sendBeacon) or application/json
    const raw = await req.text();
    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }

    const event_type: string = body.event_type || 'page_view';
    const affiliate_id: string | null = body.affiliate_id || null;
    const campaign_id: string | null = body.campaign_id || null;

    const event_data =
      body.event_data && typeof body.event_data === 'object'
        ? body.event_data
        : {};

    const { amount: eventAmount, currency: eventCurrency } =
      extractAmountAndCurrency(event_data);

    // Resolve offer_id from campaign if not provided
    let offer_id: string | null = body.offer_id || null;
    if (!offer_id && campaign_id) {
      const { data: camp } = await supabase
        .from('live_campaigns')
        .select('offer_id')
        .eq('id', campaign_id)
        .maybeSingle();
      offer_id = camp?.offer_id || null;
    }

    // Insert tracking event
    const { data: inserted, error: insertErr } = await supabase
      .from('campaign_tracking_events')
      .insert([
        {
          event_type,
          affiliate_id,
          campaign_id,
          offer_id,
          event_data,
          amount: eventAmount,
          currency: eventCurrency,
          ip_address: req.headers.get('x-forwarded-for') || null,
          user_agent: req.headers.get('user-agent') || null,
        },
      ])
      .select()
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json({ ok: true });
    }

    // For non-conversion, we’re done.
    if (event_type !== 'conversion') {
      return NextResponse.json({ ok: true });
    }

    // -------- Conversion handling (idempotent) --------
    try {
      const { error: processedErr } = await supabase
        .from('processed_conversions')
        .insert([{ event_id: inserted.id }]);
      if (processedErr) {
        // Already processed
        return NextResponse.json({ ok: true });
      }

      // Fetch campaign (to link business + affiliate)
      const { data: campaign } = await supabase
        .from('live_campaigns')
        .select('id, offer_id, business_email, affiliate_email')
        .eq('id', campaign_id)
        .maybeSingle();
      if (!campaign) {
        return NextResponse.json({ ok: true });
      }

      const resolvedOfferId = offer_id || campaign.offer_id;

      // Fetch offer
      let offer: any = null;
      if (resolvedOfferId) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('commission, platform_fee_percent, currency')
          .eq('id', resolvedOfferId)
          .maybeSingle();
        offer = offerData;
      }

      // Fetch business profile (payer)
      const { data: business } = await supabase
        .from('business_profiles')
        .select('stripe_customer_id, currency')
        .eq('business_email', campaign.business_email)
        .maybeSingle();
      if (!business) {
        return NextResponse.json({ ok: true });
      }

      // Fetch affiliate profile (for later transfers)
      let affiliate: any = null;
      if (campaign.affiliate_email) {
        const { data: aff } = await supabase
          .from('affiliate_profiles')
          .select('stripe_account_id')
          .eq('email', campaign.affiliate_email)
          .maybeSingle();
        affiliate = aff;
      }

      // Determine gross + currency
      let gross =
        typeof inserted.amount === 'number'
          ? inserted.amount
          : eventAmount || 0;

      let currency =
        (inserted.currency &&
        typeof inserted.currency === 'string'
          ? inserted.currency.toLowerCase()
          : eventCurrency || null) ||
        (offer?.currency
          ? String(offer.currency).toLowerCase()
          : null) ||
        (business?.currency
          ? String(business.currency).toLowerCase()
          : null) ||
        'aud';

      // Commission-based payout
      const commissionPct = Number(offer?.commission ?? 30); // default 30% if missing
      const affiliatePayout = Math.max(
        0,
        gross * (commissionPct / 100)
      );

      // Platform fee
      let platformFee = 0;
      if (offer && offer.platform_fee_percent != null) {
        platformFee =
          gross *
          (Number(offer.platform_fee_percent) / 100);
      }

      const businessCharge = affiliatePayout + platformFee;

      // Insert pending wallet rows
      await supabase.from('wallet_payouts').insert([
        {
          affiliate_email: campaign.affiliate_email,
          amount: affiliatePayout,
          status: 'pending',
          source_event_id: inserted.id,
          campaign_id,
          offer_id: resolvedOfferId,
        },
      ]);

      await supabase.from('wallet_deductions').insert([
        {
          business_email: campaign.business_email,
          amount: businessCharge,
          reason: 'affiliate_conversion',
          source_event_id: inserted.id,
          campaign_id,
          offer_id: resolvedOfferId,
          status: 'pending',
        },
      ]);

      // Stripe charge attempt (no hard fail if not possible)
      if (business.stripe_customer_id && businessCharge > 0) {
        try {
          // @ts-ignore
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(
            process.env.STRIPE_SECRET_KEY!,
            { apiVersion: '2025-08-27.basil' as any }
          );

          await stripe.paymentIntents.create({
            amount: Math.round(businessCharge * 100),
            currency,
            customer: business.stripe_customer_id,
            automatic_payment_methods: { enabled: true },
            off_session: true,
            confirm: true,
            description: 'Nettmark affiliate conversion',
            metadata: {
              campaign_id,
              offer_id: resolvedOfferId || '',
              event_id: inserted.id,
              affiliate_email:
                campaign.affiliate_email || '',
            },
          });

          await supabase
            .from('wallet_deductions')
            .update({ status: 'succeeded' })
            .eq('source_event_id', inserted.id);
        } catch {
          await supabase
            .from('wallet_deductions')
            .update({ status: 'failed' })
            .eq('source_event_id', inserted.id);
        }
      }
    } catch {
      // swallow – tracking event is stored, conversion side can be retried
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}