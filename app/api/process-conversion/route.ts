// app/api/process-conversion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper: create payout rows based on offer payout settings
async function createPayoutsForConversion(opts: {
  event: any;              // row from campaign_tracking_events
  offer: any;              // row from offers
  affiliateEmail: string;
  businessEmail: string;
  basePayoutAmount: number; // total commission amount for this conversion
}) {
  const {
    event,
    offer,
    affiliateEmail,
    businessEmail,
    basePayoutAmount,
  } = opts;

  // Avoid double-inserting if this event already has payouts
  const { data: existing, error: existingError } = await supabase
    .from('wallet_payouts')
    .select('id')
    .eq('source_event_id', event.id)
    .limit(1);

  if (!existingError && existing && existing.length > 0) {
    console.log('[ℹ️ Payouts already exist for event]', event.id);
    return;
  }

  const payoutMode: string = offer.payout_mode || 'upfront';
  const payoutInterval: string = offer.payout_interval || 'monthly';
  const payoutCycles: number | null = offer.payout_cycles;

  const isRecurringOffer = offer.type === 'recurring';

  // Simple upfront payout (also covers non-recurring offers)
  if (!isRecurringOffer || payoutMode === 'upfront' || !payoutCycles || payoutCycles <= 1) {
    const { error: insertError } = await supabase.from('wallet_payouts').insert({
      business_email: businessEmail,
      affiliate_email: affiliateEmail,
      offer_id: offer.id,
      amount: basePayoutAmount,
      status: 'pending',
      source_event_id: event.id,
      cycle_number: 1,
      available_at: new Date().toISOString(),
      is_recurring: isRecurringOffer,
    });

    if (insertError) {
      console.error('[❌ Failed to insert upfront payout]', insertError);
    } else {
      console.log('[✅ Inserted upfront payout for event]', event.id);
    }
    return;
  }

  // Recurring + spread across cycles
  const cycles = payoutCycles;
  const perCycle = basePayoutAmount / cycles;

  // Base time: when the conversion happened
  const baseTime = event.created_at
    ? new Date(event.created_at)
    : new Date();

  const rows: any[] = [];
  for (let i = 1; i <= cycles; i++) {
    const availableAt = new Date(baseTime.getTime());

    if (payoutInterval === 'monthly') {
      availableAt.setMonth(availableAt.getMonth() + i); // +1 month per cycle
    } else {
      // Fallback: still monthly for now
      availableAt.setMonth(availableAt.getMonth() + i);
    }

    rows.push({
      business_email: businessEmail,
      affiliate_email: affiliateEmail,
      offer_id: offer.id,
      amount: perCycle,
      status: 'pending',
      source_event_id: event.id,
      cycle_number: i,
      available_at: availableAt.toISOString(),
      is_recurring: true,
    });
  }

  const { error: spreadError } = await supabase.from('wallet_payouts').insert(rows);
  if (spreadError) {
    console.error('[❌ Failed to insert recurring payout rows]', spreadError);
  } else {
    console.log('[✅ Inserted recurring payout rows]', {
      event_id: event.id,
      cycles,
      perCycle,
      total: basePayoutAmount,
    });
  }
}

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
      .select('commission, commission_value, business_email, type, payout_mode, payout_interval, payout_cycles')
      .eq('id', resolvedOfferId)
      .maybeSingle();

    if (offerErr || !offer) {
      console.error('[process-conversion] offer fetch error', offerErr);
      return NextResponse.json(
        { error: 'offer_not_found' },
        { status: 400 }
      );
    }

    // Prefer `commission` (numeric percent); fall back to `commission_value` for older offers
    const commissionRaw =
      offer.commission != null && !isNaN(Number(offer.commission))
        ? Number(offer.commission)
        : offer.commission_value != null && !isNaN(Number(offer.commission_value))
          ? Number(offer.commission_value)
          : 0;

    const commissionPct = commissionRaw;

    console.log('[process-conversion] commission debug', {
      offer_id: resolvedOfferId,
      commission: offer.commission,
      commission_value: offer.commission_value,
      commissionPct,
    });

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

    // 5) Create pending payout rows (handles upfront vs recurring)
    await createPayoutsForConversion({
      event,
      offer,
      affiliateEmail: campaign.affiliate_email,
      businessEmail: offer.business_email,
      basePayoutAmount: affiliatePayout,
    });

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