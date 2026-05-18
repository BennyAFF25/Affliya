// app/api/process-conversion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertAdIdeaLaunchApproved, assertAffiliateOfferApproved } from '@/../utils/approvals/enforcement';
import { tryWriteMoneyFlowAudit } from '@/../utils/moneyFlowAudit';
import { computeEligibleConversionAmount, resolveOfferScopeConfig } from '@/../utils/offers/conversionScope';
import { quarantineBillableEvent } from '@/../utils/tracking/quarantine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isRpcMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? error.code : null;
  return code === 'PGRST202';
}

async function createPayoutsForConversion(opts: {
  event: any;
  offer: any;
  affiliateEmail: string;
  businessEmail: string;
  basePayoutAmount: number;
}) {
  const {
    event,
    offer,
    affiliateEmail,
    businessEmail,
    basePayoutAmount,
  } = opts;

  const payoutMode: string = offer.payout_mode || 'upfront';
  const payoutInterval: string = offer.payout_interval || 'monthly';
  const payoutCycles: number | null = offer.payout_cycles;
  const isRecurringOffer = offer.type === 'recurring';

  const { data, error } = await supabase.rpc('create_wallet_payouts_for_conversion', {
    p_source_event_id: event.id,
    p_business_email: businessEmail,
    p_affiliate_email: affiliateEmail,
    p_offer_id: offer.id,
    p_base_payout_amount: basePayoutAmount,
    p_is_recurring: isRecurringOffer,
    p_payout_mode: payoutMode,
    p_payout_interval: payoutInterval,
    p_payout_cycles: payoutCycles,
    p_event_created_at: event.created_at || new Date().toISOString(),
  });

  if (error && !isRpcMissing(error)) {
    throw error;
  }

  if (!error) {
    return data;
  }

  const { data: existing, error: existingError } = await supabase
    .from('wallet_payouts')
    .select('id')
    .eq('source_event_id', event.id)
    .limit(1);

  if (!existingError && existing && existing.length > 0) {
    return {
      success: true,
      idempotent: true,
      insertedCount: 0,
      existingCount: existing.length,
      fallback: true,
    };
  }

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
      throw insertError;
    }

    return {
      success: true,
      idempotent: false,
      insertedCount: 1,
      existingCount: 0,
      fallback: true,
    };
  }

  const cycles = payoutCycles;
  const perCycle = basePayoutAmount / cycles;
  const baseTime = event.created_at ? new Date(event.created_at) : new Date();

  const rows: any[] = [];
  for (let i = 1; i <= cycles; i++) {
    const availableAt = new Date(baseTime.getTime());
    availableAt.setMonth(availableAt.getMonth() + i);

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
    throw spreadError;
  }

  return {
    success: true,
    idempotent: false,
    insertedCount: rows.length,
    existingCount: 0,
    fallback: true,
  };
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

    const { data: processedConversion } = await supabase
      .from('processed_conversions')
      .select('event_id')
      .eq('event_id', event_id)
      .maybeSingle();

    if (processedConversion) {
      return NextResponse.json({
        ok: true,
        already_processed: true,
        event_id,
      });
    }

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

    if (!event.campaign_id) {
      return NextResponse.json(
        { error: 'missing_campaign_id_on_event' },
        { status: 400 }
      );
    }

    let campaign: any = null;
    let campaignSource: 'live_campaigns' | 'live_ads' | null = null;

    const { data: organicCampaign, error: organicCampErr } = await supabase
      .from('live_campaigns')
      .select('id, offer_id, business_email, affiliate_email')
      .eq('id', event.campaign_id)
      .maybeSingle();

    if (organicCampaign) {
      campaign = organicCampaign;
      campaignSource = 'live_campaigns';
    } else {
      const { data: paidCampaign, error: paidCampErr } = await supabase
        .from('live_ads')
        .select('id, offer_id, business_email, affiliate_email, ad_idea_id')
        .eq('id', event.campaign_id)
        .maybeSingle();

      if (paidCampaign) {
        campaign = paidCampaign;
        campaignSource = 'live_ads';
      } else {
        await quarantineBillableEvent(supabase as never, {
          sourceRoute: 'app/api/process-conversion/route.ts',
          reasonCode: 'UNRESOLVED_RUNTIME_CAMPAIGN',
          message: 'Stored conversion event could not be resolved to a live campaign or live ad.',
          eventId: event_id,
          eventType: String(event.event_type || 'conversion'),
          rawCampaignId: String(event.campaign_id || ''),
          affiliateId: typeof event.affiliate_id === 'string' ? event.affiliate_id : null,
          eventSnapshot: event,
        });

        console.error('[process-conversion] campaign fetch error', {
          organicCampErr,
          paidCampErr,
          event_id,
          campaign_id: event.campaign_id,
        });
        return NextResponse.json(
          { error: 'campaign_not_found' },
          { status: 400 }
        );
      }
    }

    const resolvedOfferId = event.offer_id || campaign.offer_id;
    if (!resolvedOfferId) {
      await quarantineBillableEvent(supabase as never, {
        sourceRoute: 'app/api/process-conversion/route.ts',
        reasonCode: 'UNRESOLVED_BILLABLE_OFFER',
        message: 'Stored conversion event did not resolve to an exact offer id.',
        eventId: event_id,
        eventType: String(event.event_type || 'conversion'),
        rawCampaignId: String(event.campaign_id || ''),
        resolvedCampaignId: typeof event.campaign_id === 'string' ? event.campaign_id : null,
        affiliateId: campaign.affiliate_email,
        eventSnapshot: event,
      });

      return NextResponse.json(
        { error: 'offer_not_resolved' },
        { status: 400 }
      );
    }

    const approvalCheck = await assertAffiliateOfferApproved(supabase as never, {
      offerId: resolvedOfferId,
      affiliateEmail: campaign.affiliate_email,
    });

    if (!approvalCheck.ok) {
      return NextResponse.json(
        {
          error: approvalCheck.error,
          message: approvalCheck.message,
          event_id,
          campaign_id: event.campaign_id,
          offer_id: resolvedOfferId,
        },
        { status: approvalCheck.status }
      );
    }

    if (campaignSource === 'live_ads' && campaign.ad_idea_id) {
      const paidLaunchApproval = await assertAdIdeaLaunchApproved(supabase as never, {
        adIdeaId: campaign.ad_idea_id,
        offerId: resolvedOfferId,
        affiliateEmail: campaign.affiliate_email,
      });

      if (!paidLaunchApproval.ok) {
        return NextResponse.json(
          {
            error: paidLaunchApproval.error,
            message: paidLaunchApproval.message,
            event_id,
            campaign_id: event.campaign_id,
            offer_id: resolvedOfferId,
          },
          { status: paidLaunchApproval.status }
        );
      }
    }

    const { data: offer, error: offerErr } = await supabase
      .from('offers')
      .select('id, commission, commission_value, business_email, type, payout_mode, payout_interval, payout_cycles, conversion_scope, eligible_product_ids, eligible_variant_ids')
      .eq('id', resolvedOfferId)
      .maybeSingle();

    if (offerErr || !offer) {
      console.error('[process-conversion] offer fetch error', offerErr);
      return NextResponse.json(
        { error: 'offer_not_found' },
        { status: 400 }
      );
    }

    const commissionPct =
      offer.commission != null && !isNaN(Number(offer.commission))
        ? Number(offer.commission)
        : 0;

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

    const scopeConfig = resolveOfferScopeConfig(offer);
    const eligibility = computeEligibleConversionAmount({
      offer,
      grossAmount: gross,
      eventData: event.event_data,
    });

    if (eligibility.reason === 'invalid_scope_config') {
      await quarantineBillableEvent(supabase as never, {
        sourceRoute: 'app/api/process-conversion/route.ts',
        reasonCode: 'INVALID_OFFER_SCOPE_CONFIG',
        message: 'Offer is set to specific-product commission but has no eligible product or variant ids configured.',
        eventId: event_id,
        eventType: String(event.event_type || 'conversion'),
        rawCampaignId: String(event.campaign_id || ''),
        resolvedCampaignId: typeof event.campaign_id === 'string' ? event.campaign_id : null,
        affiliateId: campaign.affiliate_email,
        offerId: resolvedOfferId,
        eventSnapshot: event,
      });

      return NextResponse.json(
        {
          error: 'invalid_offer_scope_config',
          message:
            'This offer is scoped to specific products, but no eligible product ids or variant ids are configured.',
        },
        { status: 400 },
      );
    }

    if (eligibility.reason === 'missing_item_data') {
      await quarantineBillableEvent(supabase as never, {
        sourceRoute: 'app/api/process-conversion/route.ts',
        reasonCode: 'MISSING_CONVERSION_ITEM_DATA',
        message: 'Conversion arrived without enough line-item or product identity data to evaluate a product-scoped offer.',
        eventId: event_id,
        eventType: String(event.event_type || 'conversion'),
        rawCampaignId: String(event.campaign_id || ''),
        resolvedCampaignId: typeof event.campaign_id === 'string' ? event.campaign_id : null,
        affiliateId: campaign.affiliate_email,
        offerId: resolvedOfferId,
        eventSnapshot: event,
      });

      return NextResponse.json(
        {
          error: 'missing_conversion_item_data',
          message:
            'This offer only pays on specific products, but the conversion did not include enough product or line-item data to verify eligibility.',
        },
        { status: 400 },
      );
    }

    if (eligibility.reason === 'no_matching_products') {
      await tryWriteMoneyFlowAudit(supabase as never, {
        eventType: 'wallet_payout_skipped',
        severity: 'info',
        sourceRoute: 'app/api/process-conversion/route.ts',
        entityType: 'campaign_tracking_event',
        entityId: event_id,
        affiliateEmail: campaign.affiliate_email,
        businessEmail: offer.business_email,
        offerId: resolvedOfferId,
        campaignId: typeof event.campaign_id === 'string' ? event.campaign_id : null,
        reasonCode: 'NO_MATCHING_ELIGIBLE_PRODUCTS',
        message: 'Conversion was tracked but did not include any eligible products for this offer scope.',
        metadata: {
          gross,
          commissionPct,
          scopeConfig,
          eligibility,
        },
      });

      const { error: processedConvError } = await supabase
        .from('processed_conversions')
        .insert([{ event_id }]);

      if (processedConvError) {
        console.error('[process-conversion] processed_conversions insert error', processedConvError);
      }

      return NextResponse.json({
        ok: true,
        event_id,
        gross,
        eligibleGross: 0,
        commissionPct,
        affiliatePayout: 0,
        payoutSkipped: true,
        payoutSkipReason: 'no_matching_eligible_products',
      });
    }

    const eligibleGross = eligibility.eligibleAmount;

    if (eligibleGross <= 0) {
      return NextResponse.json(
        { error: 'eligible_amount_not_positive' },
        { status: 400 }
      );
    }

    const affiliatePayout = (eligibleGross * commissionPct) / 100;

    const payoutResult = await createPayoutsForConversion({
      event,
      offer,
      affiliateEmail: campaign.affiliate_email,
      businessEmail: offer.business_email,
      basePayoutAmount: affiliatePayout,
    });

    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: 'wallet_payout_created',
      severity: 'info',
      sourceRoute: 'app/api/process-conversion/route.ts',
      entityType: 'campaign_tracking_event',
      entityId: event_id,
      affiliateEmail: campaign.affiliate_email,
      businessEmail: offer.business_email,
      offerId: resolvedOfferId,
      campaignId: typeof event.campaign_id === 'string' ? event.campaign_id : null,
      reasonCode: payoutResult?.fallback
        ? 'CONVERSION_PAYOUT_CREATED_FALLBACK'
        : 'CONVERSION_PAYOUT_CREATED',
      message: payoutResult?.idempotent
        ? 'Conversion payout request resolved idempotently.'
        : 'Conversion payout rows were created for a verified conversion.',
      metadata: {
        gross,
        eligibleGross,
        commissionPct,
        affiliatePayout,
        payoutResult,
        campaignSource,
        scopeConfig,
        eligibility,
      },
    });

    const { error: processedConvError } = await supabase
      .from('processed_conversions')
      .insert([{ event_id }]);

    if (processedConvError) {
      console.error('[process-conversion] processed_conversions insert error', processedConvError);
    }

    return NextResponse.json({
      ok: true,
      event_id,
      gross,
      eligibleGross,
      commissionPct,
      affiliatePayout,
      payoutResult,
    });
  } catch (e) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: 'wallet_payout_creation_failed',
      severity: 'error',
      sourceRoute: 'app/api/process-conversion/route.ts',
      reasonCode: 'PROCESS_CONVERSION_UNHANDLED',
      message: e instanceof Error ? e.message : 'Unhandled process-conversion error',
      metadata: {
        error: e instanceof Error ? e.stack || e.message : String(e),
      },
    });
    console.error('[process-conversion] unhandled', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
