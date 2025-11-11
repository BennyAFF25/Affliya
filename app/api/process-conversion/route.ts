// app/api/process-conversion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { event_id } = await req.json().catch(() => ({}));

    if (!event_id) {
      return NextResponse.json(
        { error: 'event_id required' },
        { status: 400 }
      );
    }

    // 1) Load event
    const { data: event, error: eventErr } = await supabase
      .from('campaign_tracking_events')
      .select('*')
      .eq('id', event_id)
      .maybeSingle();

    if (eventErr || !event) {
      console.error('[process-conversion] event fetch error', eventErr);
      return NextResponse.json(
        { error: 'event_not_found' },
        { status: 404 }
      );
    }

    if (event.event_type !== 'conversion') {
      return NextResponse.json(
        { error: 'not_a_conversion' },
        { status: 400 }
      );
    }

    if (event.amount == null || isNaN(Number(event.amount))) {
      return NextResponse.json(
        { error: 'no_amount_on_event' },
        { status: 400 }
      );
    }

    const gross = Number(event.amount);

    // 2) Resolve campaign
    if (!event.campaign_id) {
      return NextResponse.json(
        { error: 'missing_campaign_id_on_event' },
        { status: 400 }
      );
    }

    const { data: campaign, error: campErr } = await supabase
      .from('live_campaigns')
      .select('id, offer_id, business_email, affiliate_email')
      .eq('id', event.campaign_id)
      .maybeSingle();

    if (campErr || !campaign) {
      console.error('[process-conversion] campaign fetch error', campErr);
      return NextResponse.json(
        { error: 'campaign_not_found' },
        { status: 400 }
      );
    }

    const resolvedOfferId = event.offer_id || campaign.offer_id;
    if (!resolvedOfferId) {
      return NextResponse.json(
        { error: 'offer_not_resolved' },
        { status: 400 }
      );
    }

    // 3) Load offer for commission
    const { data: offer, error: offerErr } = await supabase
      .from('offers')
      .select('commission')
      .eq('id', resolvedOfferId)
      .maybeSingle();

    if (offerErr || !offer) {
      console.error('[process-conversion] offer fetch error', offerErr);
      return NextResponse.json(
        { error: 'offer_not_found' },
        { status: 400 }
      );
    }

    const commissionPct = offer.commission != null
      ? Number(offer.commission)
      : 0;

    if (commissionPct <= 0) {
      return NextResponse.json(
        { error: 'invalid_commission' },
        { status: 400 }
      );
    }

    const affiliatePayout = (gross * commissionPct) / 100;

    // 4) Idempotency: has this event already produced a payout?
    const { data: existingPayout, error: payoutCheckErr } = await supabase
      .from('wallet_payouts')
      .select('id')
      .eq('source_event_id', event_id)
      .maybeSingle();

    if (payoutCheckErr) {
      console.error('[process-conversion] payout check error', payoutCheckErr);
    }

    if (existingPayout) {
      // already processed, don't double-create
      return NextResponse.json({
        ok: true,
        already_processed: true,
        affiliatePayout,
      });
    }

    // 5) Create pending payout (no Stripe yet)
    const { error: insertPayoutErr } = await supabase
      .from('wallet_payouts')
      .insert([
        {
          affiliate_email: campaign.affiliate_email,
          amount: affiliatePayout,
          status: 'pending',          // pending until Stripe confirms, etc.
          source_event_id: event_id,
          campaign_id: event.campaign_id,
          offer_id: resolvedOfferId,
        },
      ]);

    if (insertPayoutErr) {
      console.error('[process-conversion] insert payout error', insertPayoutErr);
      return NextResponse.json(
        { error: 'payout_insert_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      event_id,
      gross,
      commissionPct,
      affiliatePayout,
    });
  } catch (e) {
    console.error('[process-conversion] unhandled', e);
    return NextResponse.json(
      { error: 'unhandled' },
      { status: 500 }
    );
  }
}