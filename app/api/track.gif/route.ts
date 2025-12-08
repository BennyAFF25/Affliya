// app/api/track.gif/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only
);

// tiny transparent 1x1 GIF
const GIF = Uint8Array.from([
  71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,1,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59
]);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Required
    const event_type = url.searchParams.get('t') || 'page_view';

    // Attribution
    const affiliate_id = url.searchParams.get('aff');    // nm_aff
    const campaign_id  = url.searchParams.get('camp');   // nm_camp

    // Optional payload (URL-encoded JSON)
    const d = url.searchParams.get('d');
    let event_data: any = {};
    if (d) {
      try { event_data = JSON.parse(d); } catch {}
    }

    // Normalize amount/currency from multiple possible shapes (string/number; alt keys)
    let eventAmount: number | null = null;
    if (event_data && typeof event_data === 'object') {
      const candidates = [
        (event_data as any).amount,
        (event_data as any).total,
        (event_data as any).value,
        (event_data as any).total_price,
        (event_data as any).order_total,
        (event_data as any).price,
        (event_data as any)?.totalPrice?.amount,    // Shopify moneyV2
      ];
      for (const c of candidates) {
        const n = typeof c === 'string' ? parseFloat(c) : (typeof c === 'number' ? c : NaN);
        if (!Number.isNaN(n)) { eventAmount = n; break; }
      }
    }

    let eventCurrency: string | null = null;
    if (event_data && typeof event_data === 'object') {
      const currencyCandidates = [
        (event_data as any).currency,
        (event_data as any).currency,
        (event_data as any).currencyCode,
        (event_data as any)?.totalPrice?.currencyCode,
      ];
      for (const cur of currencyCandidates) {
        if (typeof cur === 'string' && cur.trim()) { eventCurrency = cur.toLowerCase(); break; }
      }
    }

    // Resolve offer_id from campaign if available (best-effort)
    let offer_id: string | null = null;
    if (campaign_id) {
      // 1) Try organic live_campaigns
      const { data: organicCamp } = await supabase
        .from('live_campaigns')
        .select('offer_id')
        .eq('id', campaign_id)
        .maybeSingle();

      if (organicCamp?.offer_id) {
        offer_id = organicCamp.offer_id;
      } else {
        // 2) Fallback to paid Meta live_ads
        const { data: paidCamp } = await supabase
          .from('live_ads')
          .select('offer_id')
          .eq('id', campaign_id)
          .maybeSingle();
        if (paidCamp?.offer_id) {
          offer_id = paidCamp.offer_id;
        }
      }
    }

    // Insert tracking event and get inserted row
    const { data: inserted, error: insertEventError } = await supabase
      .from('campaign_tracking_events')
      .insert([{
        event_type,
        affiliate_id,
        campaign_id,
        offer_id,
        event_data,
        amount: eventAmount,
        currency: eventCurrency,
        ip_address: req.headers.get('x-forwarded-for') || null,
        user_agent: req.headers.get('user-agent') || null,
      }])
      .select()
      .single();

    // Always return a 1x1 GIF response helper
    const gifResponse = () => new NextResponse(GIF, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

    if (insertEventError || !inserted) {
      return gifResponse();
    }

    // If not a conversion event, return immediately
    if (event_type !== 'conversion') {
      return gifResponse();
    }

    // Conversion event processing
    try {
      // Insert into processed_conversions for idempotency
      const { error: processedConvError } = await supabase
        .from('processed_conversions')
        .insert([{ event_id: inserted.id }]);
      if (processedConvError) {
        // If conflict (already processed), return GIF
        return gifResponse();
      }

      // Fetch campaign – support BOTH organic and paid Meta
      let campaign: any = null;

      if (campaign_id) {
        // 1) Try organic live_campaigns
        const { data: organic } = await supabase
          .from('live_campaigns')
          .select('id, offer_id, business_email, affiliate_email')
          .eq('id', campaign_id)
          .maybeSingle();

        if (organic) {
          campaign = organic;
        } else {
          // 2) Try paid Meta live_ads
          const { data: paid } = await supabase
            .from('live_ads')
            .select('id, offer_id, business_email, affiliate_email')
            .eq('id', campaign_id)
            .maybeSingle();
          if (paid) {
            campaign = paid;
          }
        }
      }

      if (!campaign) return gifResponse();

      // Determine resolvedOfferId
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

      // Fetch business
      const { data: business } = await supabase
        .from('business_profiles')
        .select('stripe_customer_id, currency')
        .eq('business_email', campaign.business_email)
        .maybeSingle();
      if (!business) return gifResponse();

      // Fetch affiliate
      let affiliate: any = null;
      if (campaign.affiliate_email) {
        const { data: aff } = await supabase
          .from('affiliate_profiles')
          .select('stripe_account_id')
          .eq('email', campaign.affiliate_email)
          .maybeSingle();
        affiliate = aff;
      }

      // Read amount and currency from event_data
      let gross = typeof inserted.amount === 'number' ? inserted.amount : 0;
      let currency = (inserted.currency && typeof inserted.currency === 'string')
        ? inserted.currency.toLowerCase()
        : 'aud';
      if (!currency && offer?.currency) currency = String(offer.currency).toLowerCase();
      if (!currency && business?.currency) currency = String(business.currency).toLowerCase();

      // Calculate affiliatePayout
      const commissionPct = Number(offer?.commission ?? 30);
      const affiliatePayout = Math.max(0, gross * (commissionPct / 100));

      // Platform fee
      let platformFee = 0;
      if (offer && offer.platform_fee_percent != null) {
        platformFee = gross * (Number(offer.platform_fee_percent) / 100);
      }

      // Business charge
      const businessCharge = affiliatePayout + platformFee;

      // Insert wallet_payouts
      await supabase.from('wallet_payouts').insert([{
        affiliate_email: campaign.affiliate_email,
        amount: affiliatePayout,
        status: 'pending',
        source_event_id: inserted.id,
        campaign_id,
        offer_id: resolvedOfferId,
      }]);

      // Insert wallet_deductions
      await supabase.from('wallet_deductions').insert([{
        business_email: campaign.business_email,
        amount: businessCharge,
        reason: 'affiliate_conversion',
        source_event_id: inserted.id,
        campaign_id,
        offer_id: resolvedOfferId,
        status: 'pending',
      }]);

      // Stripe payment intent if possible
      if (business.stripe_customer_id && businessCharge > 0) {
        try {
          // Dynamically import Stripe
          // @ts-ignore
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' as any });
          await stripe.paymentIntents.create({
            amount: Math.round(businessCharge * 100),
            currency,
            customer: business.stripe_customer_id,
            automatic_payment_methods: { enabled: true },
            off_session: true,
            confirm: true,
            description: `Nettmark affiliate conversion`,
            metadata: {
              campaign_id,
              offer_id: resolvedOfferId || '',
              event_id: inserted.id,
              affiliate_email: campaign.affiliate_email || '',
            },
          });
          // Update wallet_deductions to succeeded
          await supabase.from('wallet_deductions')
            .update({ status: 'succeeded' })
            .eq('source_event_id', inserted.id);
        } catch {
          // Update wallet_deductions to failed
          await supabase.from('wallet_deductions')
            .update({ status: 'failed' })
            .eq('source_event_id', inserted.id);
        }
      }
    } catch {
      // swallow, always return GIF
    }
    return gifResponse();
  } catch {
    // even on error, send a 1x1 so the page never hangs
    return new NextResponse(GIF, {
      status: 200,
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' }
    });
  }
}