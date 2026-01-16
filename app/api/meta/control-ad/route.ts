// app/api/meta/control-ad/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_API_VERSION = 'v21.0'; // keep in sync with other Meta routes
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN!;

export async function POST(req: Request) {
  try {
    const { liveAdId, action } = await req.json();

    if (!liveAdId || !action) {
      return NextResponse.json(
        { error: 'Missing liveAdId or action' },
        { status: 400 }
      );
    }

    // 1) Load live_ads row (we need meta_campaign_id + meta_ad_id + business_email)
    const { data: liveAd, error: liveErr } = await supabase
      .from('live_ads')
      .select('id, meta_ad_id, meta_campaign_id, status, business_email')
      .eq('id', liveAdId)
      .single();

    if (liveErr || !liveAd) {
      console.error('[❌ live_ads lookup failed]', liveErr);
      return NextResponse.json(
        { error: 'LIVE_AD_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 2) Get the Meta access token for this business from meta_connections
    const { data: metaConn, error: metaErr } = await supabase
      .from('meta_connections')
      .select('access_token')
      .eq('business_email', (liveAd as any).business_email)
      .single();

    if (metaErr || !metaConn?.access_token) {
      console.error('[❌ meta_connections lookup failed]', metaErr);
      return NextResponse.json(
        { error: 'META_CONNECTION_NOT_FOUND' },
        { status: 400 }
      );
    }

    const accessToken = metaConn.access_token;

    // Prefer controlling the ad first, then ad set, then campaign
    const adId = liveAd.meta_ad_id as string | null;
    const adSetId = (liveAd as any).ad_set_id as string | null;
    const campaignId = (liveAd as any).meta_campaign_id as string | null;

    let targetId: string | null = null;
    let targetType: string | null = null;

    if (adId) {
      targetId = adId;
      targetType = 'ad';
    } else if (adSetId) {
      targetId = adSetId;
      targetType = 'adset';
    } else if (campaignId) {
      targetId = campaignId;
      targetType = 'campaign';
    }

    if (!targetId) {
      console.error('[❌ Missing Meta object IDs]');
      return NextResponse.json(
        { error: 'MISSING_META_OBJECT_ID' },
        { status: 400 }
      );
    }

    console.log('[Meta control] Using target object for status update', {
      liveAdId,
      targetType,
      targetId,
      action,
    });

    // 2) Decide target status
    let targetStatus: 'ACTIVE' | 'PAUSED' | 'DELETED';
    let localStatus: string;

    switch (action) {
      case 'PAUSE':
        targetStatus = 'PAUSED';
        localStatus = 'paused';
        break;
      case 'RESUME':
        targetStatus = 'ACTIVE';
        localStatus = 'active';
        break;
      case 'ARCHIVE':
        // Meta usually archives, not truly deletes, but DELETED is valid.
        targetStatus = 'PAUSED';
        localStatus = 'archived';
        break;
      default:
        return NextResponse.json(
          { error: 'INVALID_ACTION' },
          { status: 400 }
        );
    }

    // 3) Call Meta Ads API to update the status on the target object (campaign preferred)
    // IMPORTANT: send access_token as query param and body as x-www-form-urlencoded
    const url = `https://graph.facebook.com/${META_API_VERSION}/${targetId}?access_token=${encodeURIComponent(
      accessToken
    )}`;

    console.log('[Meta control] POST', url, {
      status: targetStatus,
      liveAdId,
      action,
    });

    const metaRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        status: targetStatus,
      }),
    });

    const metaJson = await metaRes.json();

    if (!metaRes.ok || (metaJson as any).error) {
      console.error('[❌ Meta control error]', metaJson);
      return NextResponse.json(
        { error: 'META_CONTROL_FAILED', details: metaJson },
        { status: 500 }
      );
    }

    console.log('[✅ Meta control success]', metaJson);

    // 4) Update Nettmark DB status
    const { error: updateErr } = await supabase
      .from('live_ads')
      .update({ status: localStatus })
      .eq('id', liveAdId);

    if (updateErr) {
      console.error('[❌ Failed to update local live_ads status]', updateErr);
    }

    return NextResponse.json({
      success: true,
      newStatus: localStatus,
    });
  } catch (err) {
    console.error('[❌ control-ad route error]', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}