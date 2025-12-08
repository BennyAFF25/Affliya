// app/go/[ref]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type SourceTable = 'live_campaigns' | 'ad_ideas' | 'live_ads' | 'offers' | null;

export async function GET(request: NextRequest, context: any) {
  const { ref } = context.params as { ref: string };
  console.log('[go/ref] Incoming tracking link:', ref);

  // --------------------------------------------------
  // 1. Parse ref -> campaignId + affiliateId + type
  // --------------------------------------------------
  let splitParts = ref.split('___');

  if (splitParts.length < 2) {
    // Legacy pattern: last '-' splits campaignId and affiliateId
    const lastDash = ref.lastIndexOf('-');
    if (lastDash !== -1) {
      splitParts = [ref.slice(0, lastDash), ref.slice(lastDash + 1)];
    } else {
      splitParts = [ref];
    }
    console.log('[go/ref] Fallback splitParts:', splitParts);
  }

  if (splitParts.length < 2) {
    console.warn('[go/ref] Invalid ref format:', ref);
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
  console.log('[go/ref] Parsed:', { campaignId, affiliateId, campaignType });

  // --------------------------------------------------
  // 2. Resolve campaign / offer for this tracking link
  // --------------------------------------------------
  let offerId: string | null = null;
  let status: string | null = null;
  let sourceTable: SourceTable = null;

  // 2.1 – Organic / live_campaigns
  try {
    const { data, error } = await supabaseAdmin
      .from('live_campaigns')
      .select('offer_id,status')
      .eq('id', campaignId)
      .maybeSingle();

    if (data?.offer_id) {
      offerId = data.offer_id as string;
      status = (data as any).status ?? null;
      sourceTable = 'live_campaigns';
      console.log('[go/ref] Matched live_campaigns:', { offerId, status });
    } else if (error) {
      console.log('[go/ref] live_campaigns lookup error:', error.message);
    }
  } catch (e) {
    console.log('[go/ref] live_campaigns lookup exception:', e);
  }

  // 2.2 – Paid / ad_ideas
  if (!offerId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('ad_ideas')
        .select('offer_id,status')
        .or(`id.eq.${campaignId},offer_id.eq.${campaignId}`)
        .maybeSingle();

      if (data?.offer_id) {
        offerId = data.offer_id as string;
        status = (data as any).status ?? null;
        sourceTable = 'ad_ideas';
        console.log('[go/ref] Matched ad_ideas:', { offerId, status });
      } else if (error) {
        console.log('[go/ref] ad_ideas lookup error:', error.message);
      }
    } catch (e) {
      console.log('[go/ref] ad_ideas lookup exception:', e);
    }
  }

  // 2.3 – Paid / live_ads
  if (!offerId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('live_ads')
        .select('offer_id,status')
        .or(`id.eq.${campaignId},offer_id.eq.${campaignId}`)
        .maybeSingle();

      if (data?.offer_id) {
        offerId = data.offer_id as string;
        status = (data as any).status ?? null;
        sourceTable = 'live_ads';
        console.log('[go/ref] Matched live_ads:', { offerId, status });
      } else if (error) {
        console.log('[go/ref] live_ads lookup error:', error.message);
      }
    } catch (e) {
      console.log('[go/ref] live_ads lookup exception:', e);
    }
  }

  // 2.4 – Legacy / offers (campaignId is directly the offer id)
  if (!offerId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('offers')
        .select('id')
        .eq('id', campaignId)
        .maybeSingle();

      if (data?.id) {
        offerId = data.id as string;
        status = 'ACTIVE';
        sourceTable = 'offers';
        console.log('[go/ref] Legacy direct offers match:', { offerId });
      } else if (error) {
        console.log('[go/ref] offers lookup error:', error.message);
      }
    } catch (e) {
      console.log('[go/ref] offers lookup exception:', e);
    }
  }

  if (!offerId) {
    console.error('[go/ref] No campaign/offer found for tracking code:', {
      ref,
      campaignId,
    });

    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;margin-top:70px">
        <h2>Tracking link not configured</h2>
        <p>We couldn&apos;t find any campaign or offer for this tracking code.</p>
        <p><strong>ref:</strong> <code>${ref}</code></p>
        <p><strong>campaignId:</strong> <code>${campaignId}</code></p>
      </body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  console.log('[go/ref] Resolved offer:', { offerId, sourceTable, status });

  // Hard stop for paused campaigns
  const campaignStatus = status ? String(status).toUpperCase() : '';
  if (campaignStatus === 'PAUSED') {
    console.warn('[go/ref] Campaign paused, blocking redirect:', {
      campaignId,
      affiliateId,
      sourceTable,
    });

    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;margin-top:100px;color:#e5e7eb;background:#020617">
        <h2 style="font-size:24px;margin-bottom:12px;">Campaign temporarily paused</h2>
        <p style="font-size:14px;line-height:1.6;max-width:520px;margin:0 auto;">
          This tracking link has been temporarily disabled by the business.
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
    .eq('id', offerId)
    .single();

  console.log('[go/ref] Offer lookup result:', { website: offer?.website });

  if (offerError || !offer?.website) {
    console.error('[go/ref] No website found for offer:', {
      offerId,
      offerError,
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
  const ipAddress =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('X-Real-IP') ||
    'unknown';

  console.log('[go/ref] Click context:', { referer, userAgent, ipAddress });

  await supabaseAdmin.from('clicks').insert([
    {
      offer_id: offerId,
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
  console.log('[go/ref] Redirecting to:', finalUrl);

  const cookieName = 'nettmark_affiliate_id';
  const cookieValue = encodeURIComponent(affiliateId);
  const cookieMaxAge = 60 * 60 * 24 * 7; // 7 days

  const response = NextResponse.redirect(finalUrl, 307);
  response.headers.append(
    'Set-Cookie',
    `${cookieName}=${cookieValue}; Path=/; Max-Age=${cookieMaxAge}; HttpOnly; Secure; SameSite=None`
  );

  return response;
}