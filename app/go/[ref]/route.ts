import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest, context: any) {
  const { ref } = context.params;
  console.log('[🔗 Redirecting from tracking link]', { ref });

  // In prod you can set NEXT_PUBLIC_BASE_URL to https://www.nettmark.com
  const fallbackUrl =
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // --------------------------------------------------
  // 1. Parse ref -> campaignId + affiliateId + type
  // --------------------------------------------------
  let splitParts = ref.split('___');

  if (splitParts.length < 2) {
    // fallback pattern: last '-' splits campaignId and affiliateId
    const lastDash = ref.lastIndexOf('-');
    if (lastDash !== -1) {
      splitParts = [ref.slice(0, lastDash), ref.slice(lastDash + 1)];
    } else {
      splitParts = [ref];
    }
    console.log('[🪓 splitParts after custom split]', splitParts);
  }

  if (splitParts.length < 2) {
    console.warn('[❌ Invalid ref format]', ref);
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;margin-top:100px">
        <h2>Invalid tracking link</h2>
        <p>We couldn&apos;t read this tracking code: <code>${ref}</code>.</p>
        <p>Please regenerate the link from Nettmark and try again.</p>
      </body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const [campaignId, affiliateId, campaignType = 'meta'] = splitParts;
  console.log('[🏷️ Campaign ID]', campaignId);
  console.log('[👤 Affiliate ID]', affiliateId);
  console.log('[🧪 Campaign Type]', campaignType);

  // --------------------------------------------------
  // 2. Resolve campaign / offer for this tracking link
  // --------------------------------------------------
  let offerId: string | null = null;
  let status: string | null = null;
  let sourceTable:
    | 'live_campaigns'
    | 'ad_ideas'
    | 'live_ads'
    | 'offers'
    | null = null;

  // 2.1 – Organic / live_campaigns
  let organicCampaign = null;
  let organicErr = null;
  try {
    const res = await supabaseAdmin
      .from('live_campaigns')
      .select('offer_id,status')
      .eq('id', campaignId)
      .maybeSingle();
    organicCampaign = res.data;
    organicErr = res.error;
  } catch (e) {
    organicErr = e;
  }

  if (organicCampaign && (organicCampaign as any).offer_id) {
    offerId = (organicCampaign as any).offer_id as string;
    status = (organicCampaign as any).status ?? null;
    sourceTable = 'live_campaigns';
    console.log('[📋 Organic campaign (live_campaigns)]', organicCampaign);
  } else {
    console.log('[ℹ️ No organic campaign found for id, trying ad_ideas]', {
      campaignId,
      organicErr,
    });
  }

  // 2.2 – Paid / ad_ideas
  let adIdeaCampaign = null;
  let adIdeaErr = null;
  if (!offerId) {
    try {
      const res = await supabaseAdmin
        .from('ad_ideas')
        .select('offer_id,status')
        .or(`id.eq.${campaignId},offer_id.eq.${campaignId}`)
        .maybeSingle();
      adIdeaCampaign = res.data;
      adIdeaErr = res.error;
    } catch (e) {
      adIdeaErr = e;
    }

    if (adIdeaCampaign && (adIdeaCampaign as any).offer_id) {
      offerId = (adIdeaCampaign as any).offer_id as string;
      status = (adIdeaCampaign as any).status ?? null;
      sourceTable = 'ad_ideas';
      console.log('[📋 Paid/meta campaign (ad_ideas)]', adIdeaCampaign);
    } else {
      console.log('[ℹ️ No ad_ideas row for id/offer_id, trying live_ads]', {
        campaignId,
        adIdeaErr,
      });
    }
  }

  // 2.3 – Paid / live_ads
  let liveAdCampaign = null;
  let liveAdErr = null;
  if (!offerId) {
    try {
      const res = await supabaseAdmin
        .from('live_ads')
        .select('offer_id,status')
        .or(`id.eq.${campaignId},offer_id.eq.${campaignId}`)
        .maybeSingle();
      liveAdCampaign = res.data;
      liveAdErr = res.error;
    } catch (e) {
      liveAdErr = e;
    }

    if (liveAdCampaign && (liveAdCampaign as any).offer_id) {
      offerId = (liveAdCampaign as any).offer_id as string;
      status = (liveAdCampaign as any).status ?? null;
      sourceTable = 'live_ads';
      console.log('[📋 Live Meta ad (live_ads)]', liveAdCampaign);
    } else {
      console.log('[ℹ️ No live_ads row for id/offer_id, trying offers]', {
        campaignId,
        liveAdErr,
      });
    }
  }

  // 2.4 – Legacy / offers (campaignId is directly the offer id)
  let offerRow = null;
  let offerIdErr = null;
  if (!offerId) {
    try {
      const res = await supabaseAdmin
        .from('offers')
        .select('id')
        .eq('id', campaignId)
        .maybeSingle();
      offerRow = res.data;
      offerIdErr = res.error;
    } catch (e) {
      offerIdErr = e;
    }

    if (offerRow?.id) {
      offerId = offerRow.id as string;
      status = 'ACTIVE';
      sourceTable = 'offers';
      console.log('[📋 Legacy ref pointing directly to offers]', offerRow);
    }
  }

  if (!offerId) {
    console.error(
      '[❌ No campaign/offer_id found in live_campaigns, ad_ideas, live_ads or offers]',
      {
        campaignId,
        organicErr,
        adIdeaErr,
        liveAdErr,
        offerIdErr,
      }
    );

    // IMPORTANT: don’t silently bounce to homepage anymore – show a debug page
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;margin-top:70px">
        <h2>Tracking link not configured</h2>
        <p>We couldn&apos;t find any campaign or offer for this tracking code.</p>
        <p><strong>ref:</strong> <code>${ref}</code></p>
        <p><strong>campaignId:</strong> <code>${campaignId}</code></p>
        <p style="margin-top:16px;max-width:620px;margin-inline:auto;font-size:13px;line-height:1.5;color:#555">
          Check Supabase for a matching row in <code>live_campaigns</code>,
          <code>ad_ideas</code>, <code>live_ads</code> or <code>offers</code> where
          <code>id = ${campaignId}</code> (or <code>offer_id = ${campaignId}</code> for ad_ideas/live_ads).
        </p>
      </body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const offerIdNonNull = offerId as string;
  console.log('[🎯 Offer ID]', offerIdNonNull, 'from', sourceTable);

  // If the campaign is paused, block redirect and show a clear message.
  const campaignStatus = status ? String(status).toUpperCase() : '';
  if (campaignStatus === 'PAUSED') {
    console.warn('[⏸️ Campaign paused – blocking redirect]', {
      campaignId,
      affiliateId,
      sourceTable,
    });

    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;margin-top:100px;color:#e5e7eb;background:#020617">
        <h2 style="font-size:24px;margin-bottom:12px;">Campaign temporarily paused</h2>
        <p style="font-size:14px;line-height:1.6;max-width:520px;margin:0 auto;">
          This tracking link has been temporarily disabled by the business while they update or review this offer.
          <br/><br/>
          Please check back later or contact the brand/affiliate manager if you believe this is a mistake.
        </p>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // --------------------------------------------------
  // 3. Get website from offers
  // --------------------------------------------------
  const { data: offer, error: offerError } = await supabaseAdmin
    .from('offers')
    .select('website')
    .eq('id', offerIdNonNull)
    .single();

  console.log('[📦 Supabase Offer Response]', { offer, offerError });
  console.log('[🌐 Offer website]', offer?.website);

  if (offerError || !offer?.website) {
    console.error('[❌ No Website Found]', {
      offerId: offerIdNonNull,
      affiliateId,
      offerError,
      result: offer,
    });

    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;margin-top:100px">
        <h2>Invalid or missing destination</h2>
        <p>This campaign link is not properly configured.<br/>
        Please contact support if you believe this is an error.</p>
      </body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // --------------------------------------------------
  // 4. Log click
  // --------------------------------------------------
  const referer = request.headers.get('referer') || '';
  const userAgent = request.headers.get('user-agent') || '';
  console.log('[🔍 Click context]', { referer, userAgent });

  const ipAddress =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('X-Real-IP') ||
    'unknown';

  await supabaseAdmin.from('clicks').insert([
    {
      offer_id: offerIdNonNull,
      affiliate_id: affiliateId,
      ref_code: ref,
      ip_address: ipAddress,
      campaign_type: campaignType,
      platform_violation: false,
      campaign_id: campaignId,
    },
  ]);

  // --------------------------------------------------
  // 5. Build redirect URL (same pattern as organic)
  // --------------------------------------------------
  let redirectUrl = offer.website as string;
  redirectUrl = redirectUrl.startsWith('http')
    ? redirectUrl
    : `https://${redirectUrl}`;

  const urlObj = new URL(redirectUrl);
  if (!urlObj.searchParams.has('nm_aff')) {
    urlObj.searchParams.set('nm_aff', affiliateId);
  }
  if (!urlObj.searchParams.has('nm_camp')) {
    urlObj.searchParams.set('nm_camp', campaignId);
  }
  if (!urlObj.searchParams.has('nm_src')) {
    urlObj.searchParams.set('nm_src', 'nettmark');
  }

  const finalUrl = urlObj.toString();
  console.log('[✅ Redirecting to]', finalUrl);

  const cookieName = 'nettmark_affiliate_id';
  const cookieValue = encodeURIComponent(affiliateId);
  const cookieMaxAge = 60 * 60 * 24 * 7; // 7 days
  const cookie = `${cookieName}=${cookieValue}; Path=/; Max-Age=${cookieMaxAge}; HttpOnly; Secure; SameSite=None`;

  const response = NextResponse.redirect(finalUrl, 307);
  response.headers.append('Set-Cookie', cookie);
  return response;
}