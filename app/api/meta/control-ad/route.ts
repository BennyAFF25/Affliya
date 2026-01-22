// app/api/meta/control-ad/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_API_VERSION = 'v21.0'; // keep in sync with other Meta routes
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN!; // kept for consistency

export async function POST(req: Request) {
  try {
    const { liveAdId, action, skipSettlement } = await req.json();

    if (!liveAdId || !action) {
      return NextResponse.json(
        { error: 'Missing liveAdId or action' },
        { status: 400 }
      );
    }

    // 1) Load live_ads row (we need meta ids + business_email)
    const { data: liveAd, error: liveErr } = await supabase
      .from('live_ads')
      .select('id, meta_ad_id, meta_campaign_id, status, business_email, ad_set_id')
      .eq('id', liveAdId)
      .single();

    if (liveErr || !liveAd) {
      console.error('[❌ live_ads lookup failed]', liveErr);
      return NextResponse.json({ error: 'LIVE_AD_NOT_FOUND' }, { status: 404 });
    }

    // 2) Get the Meta access token for this business from meta_connections
    const { data: metaConn, error: metaErr } = await supabase
      .from('meta_connections')
      .select('access_token, id, ad_account_id, created_at')
      .eq('business_email', (liveAd as any).business_email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('[Meta control] Using meta connection', {
      metaConnectionId: metaConn?.id,
      adAccountId: metaConn?.ad_account_id,
    });

    if (metaErr || !metaConn?.access_token) {
      console.error('[❌ meta_connections lookup failed]', metaErr);
      return NextResponse.json(
        { error: 'META_CONNECTION_NOT_FOUND' },
        { status: 400 }
      );
    }

    const accessToken = metaConn.access_token;

    // Prefer controlling the ad first, then ad set, then campaign
    const adId = (liveAd as any).meta_ad_id as string | null;
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
      skipSettlement: !!skipSettlement,
    });

    // 3) Decide target + local status
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
        targetStatus = 'PAUSED';
        localStatus = 'archived';
        break;
      default:
        return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
    }

    // 4) Call Meta Ads API to update the status
    const url = `https://graph.facebook.com/${META_API_VERSION}/${targetId}?access_token=${encodeURIComponent(
      accessToken
    )}`;

    console.log('[Meta control] POST', url, { status: targetStatus, liveAdId, action });

    const metaRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ status: targetStatus }),
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

    // 5) Settlement on pause/archive (unless skipped)
    const shouldSettle =
      (action === 'PAUSE' || action === 'ARCHIVE') && !skipSettlement;

    let settlement: any = null;
    let settlementError: any = null;
    let settlementSkipped = false;

    if (action === 'PAUSE' || action === 'ARCHIVE') {
      if (skipSettlement) {
        settlementSkipped = true;
        console.log('[💸 Settlement] Skipped (skipSettlement=true)', { liveAdId });
      } else {
        try {
          const settleUrl = new URL('/api/ad-spend/settle', req.url);
          console.log('[💸 Settlement] Calling', settleUrl.toString(), { liveAdId });

          const settleRes = await fetch(settleUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ liveAdId }),
          });

          settlement = await settleRes.json().catch(() => null);

          if (!settleRes.ok || !settlement?.success) {
            console.error('[❌ Settlement failed]', {
              status: settleRes.status,
              settlement,
            });
            settlementError = settlement || { error: 'SETTLEMENT_FAILED' };
          } else {
            console.log('[✅ Settlement success]', settlement);
          }
        } catch (e: any) {
          console.error('[❌ Settlement exception]', e);
          settlementError = { error: 'SETTLEMENT_EXCEPTION', message: e?.message };
        }
      }
    }

    // 6) Update Nettmark DB status (+ try optional billing fields)
    const nowIso = new Date().toISOString();

    const extendedUpdate: Record<string, any> = {
      status: localStatus,
    };

    if (action === 'PAUSE') {
      extendedUpdate.billing_state = 'PAUSED';
      extendedUpdate.billing_paused_at = nowIso;
    } else if (action === 'ARCHIVE') {
      extendedUpdate.billing_state = 'ARCHIVED';
      extendedUpdate.billing_paused_at = nowIso;
    } else if (action === 'RESUME') {
      extendedUpdate.billing_state = 'ACTIVE';
      extendedUpdate.billing_paused_at = null;
    }

    const extUpdateRes = await supabase
      .from('live_ads')
      .update(extendedUpdate)
      .eq('id', liveAdId);

    if (extUpdateRes.error) {
      console.warn(
        '[⚠️ Extended live_ads update failed — falling back to status-only]',
        extUpdateRes.error
      );

      const { error: fallbackErr } = await supabase
        .from('live_ads')
        .update({ status: localStatus })
        .eq('id', liveAdId);

      if (fallbackErr) {
        console.error('[❌ Failed to update local live_ads status]', fallbackErr);
      }
    }

    return NextResponse.json({
      success: true,
      newStatus: localStatus,
      meta: { targetType, targetId, targetStatus, response: metaJson },
      settlement: settlementError ? null : settlement,
      settlementError,
      settlementSkipped,
    });
  } catch (err) {
    console.error('[❌ control-ad route error]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}