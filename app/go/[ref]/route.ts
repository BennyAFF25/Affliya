// Requires SUPABASE_SERVICE_ROLE_KEY in your .env for backend use only.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest, context: any) {
  const { ref } = context.params;
  console.log('[🔗 Redirecting from tracking link]', { ref });

  const fallbackUrl = 'https://localhost:3000';

  // Support both ___ and - as separators for compatibility
  let splitParts = ref.split('___');
  console.log('[🪓 splitParts after split by ___]', splitParts);
  if (splitParts.length < 2) {
    splitParts = ref.split('-');
    console.log('[🪓 splitParts after split by -]', splitParts);
  }
  if (splitParts.length < 2) {
    console.warn('[❌ Invalid ref format]', ref);
    console.log('[🚫 Early return due to invalid ref format]');
    return NextResponse.redirect(fallbackUrl, 307);
  }

  const [campaignId, affiliateId, campaignType = 'meta'] = splitParts;
  console.log('[🏷️ Campaign ID]', campaignId);
  console.log('[👤 Affiliate ID]', affiliateId);

  // 1. Get live_campaign by campaignId
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('live_campaigns')
    .select('offer_id')
    .eq('id', campaignId)
    .single();
  console.log('[📋 Campaign data from supabase]', campaign);
  console.log('[⚠️ Campaign error from supabase]', campaignError);

  if (campaignError || !campaign?.offer_id) {
    console.error('[❌ No campaign/offer_id found]', { campaignId, campaignError });
    console.log('[🚫 Early return due to missing campaign or offer_id]');
    return NextResponse.redirect(fallbackUrl, 307);
  }

  const offerId = campaign.offer_id;
  console.log('[🎯 Offer ID]', offerId);

  // 2. Get the website from offers table
  const { data: offer, error: offerError } = await supabaseAdmin
    .from('offers')
    .select('website')
    .eq('id', offerId)
    .single();
  console.log('[📦 Supabase Offer Response]', { offer, offerError });
  console.log('[🌐 Offer website]', offer?.website);

  if (offerError || !offer?.website) {
    console.error('[❌ No Website Found]', {
      offerId,
      affiliateId,
      offerError,
      result: offer,
    });
    console.log('[🚫 Early return due to missing offer website]');
    // Instead of redirecting to Google, show an error page.
    // We want a clear error for invalid or missing destination, not a generic redirect.
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;margin-top:100px"><h2>Invalid or missing destination</h2><p>This campaign link is not properly configured.<br/>Please contact support if you believe this is an error.</p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Platform Violation Logic (optional, use campaignType as needed, you can expand)
  const referer = request.headers.get('referer') || '';
  const userAgent = request.headers.get('user-agent') || '';
  let platformViolation = false;
  // (Optional: fetch post to check platform, skipped for simplicity here)

  // Log click
  const ipAddress =
    request.headers.get('x-forwarded-for') || request.headers.get('X-Real-IP') || 'unknown';

  await supabaseAdmin.from('clicks').insert([
    {
      offer_id: offerId,
      affiliate_id: affiliateId,
      ref_code: ref,
      ip_address: ipAddress,
      campaign_type: campaignType,
      platform_violation: platformViolation,
      campaign_id: campaignId,
    },
  ]);

  let redirectUrl = offer.website;
  redirectUrl = redirectUrl.startsWith('http') ? redirectUrl : `https://${redirectUrl}`;
  console.log('[✅ Redirecting to]', redirectUrl);
  return NextResponse.redirect(redirectUrl, 307);
}