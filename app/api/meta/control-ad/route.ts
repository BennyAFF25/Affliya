// app/api/meta/control-ad/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_API_VERSION = 'v21.0'; // keep in sync with other Meta routes

export async function POST(req: Request) {
  try {
    const sessionClient = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const { liveAdId, action, actor } = await req.json().catch(() => ({}));
    if (
      typeof liveAdId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(liveAdId) ||
      !['PAUSE', 'RESUME', 'ARCHIVE'].includes(action) ||
      (actor !== 'business' && actor !== 'affiliate')
    ) {
      return NextResponse.json({ error: 'INVALID_CONTROL_REQUEST' }, { status: 400 });
    }
    const controlActor: 'business' | 'affiliate' = actor;

    // 1) Load live_ads row (we need meta ids + business_email)
    const { data: liveAd, error: liveErr } = await supabase
      .from('live_ads')
      .select(
        'id, meta_ad_id, meta_campaign_id, status, business_email, affiliate_email, affiliate_user_id, ad_set_id, billing_state, terminated_by_business_at'
      )
      .eq('id', liveAdId)
      .single();

    if (liveErr || !liveAd) {
      console.error('[❌ live_ads lookup failed]', liveErr);
      return NextResponse.json({ error: 'LIVE_AD_NOT_FOUND' }, { status: 404 });
    }

    const userEmail = user.email.toLowerCase();
    const isOwner = controlActor === 'business'
      ? String(liveAd.business_email || '').toLowerCase() === userEmail
      : (String(liveAd.affiliate_email || '').toLowerCase() === userEmail &&
        (!liveAd.affiliate_user_id || liveAd.affiliate_user_id === user.id));
    if (!isOwner) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const isBusinessTerminated =
      (liveAd as any).billing_state === 'TERMINATED_BY_BUSINESS' ||
      !!(liveAd as any).terminated_by_business_at;

    if (action === 'RESUME' && isBusinessTerminated) {
      return NextResponse.json(
        { error: 'CAMPAIGN_STOPPED_BY_BUSINESS', message: 'This campaign was paused by the business and cannot be reactivated.' },
        { status: 409 }
      );
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

    // Business stops are campaign-wide; affiliate pauses only control their individual ad.
    // Never pause another affiliate's ads when an affiliate uses their own control.
    const adId = (liveAd as any).meta_ad_id as string | null;
    const adSetId = (liveAd as any).ad_set_id as string | null;
    const campaignId = (liveAd as any).meta_campaign_id as string | null;

    let targetId: string | null = null;
    let targetType: string | null = null;

    if (controlActor === 'business' && campaignId) {
      targetId = campaignId;
      targetType = 'campaign';
    } else if (adId) {
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
      actor: controlActor,
    });

    // 3) Decide target + local status
    let targetStatus: 'ACTIVE' | 'PAUSED' | 'DELETED';
    let localStatus: string;

    switch (action) {
      case 'PAUSE':
        targetStatus = 'PAUSED';
        localStatus = controlActor === 'business' ? 'stopped' : 'paused';
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
    const url = `https://graph.facebook.com/${META_API_VERSION}/${targetId}`;

    // Never put access tokens in URLs: they end up in request logs and error reports.
    console.log('[Meta control] POST', { targetType, targetId, status: targetStatus, liveAdId, action, actor: controlActor });

    const metaRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${accessToken}`,
      },
      body: new URLSearchParams({ status: targetStatus }),
    });

    const metaJson = await metaRes.json().catch(() => ({}));

    if (!metaRes.ok || (metaJson as any).error || (metaJson as any).success !== true) {
      console.error('[Meta control] Meta rejected status update', {
        status: metaRes.status,
        code: (metaJson as any)?.error?.code ?? null,
      });
      return NextResponse.json(
        { error: 'META_CONTROL_FAILED', status: metaRes.status },
        { status: 502 }
      );
    }

    console.log('[✅ Meta control success]', metaJson);

    // 5) Settlement on pause/archive. Meta delivery is stopped independently
    // of settlement; an unpaid balance must be surfaced, never silently ignored.
    let settlement: any = null;
    let settlementError: { error: string; status?: number } | null = null;

    if (action === 'PAUSE' || action === 'ARCHIVE') {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        settlementError = { error: 'SETTLEMENT_AUTH_NOT_CONFIGURED' };
        console.error('[Meta control] Cannot settle: CRON_SECRET missing', { liveAdId });
      } else {
        try {
          const settleUrl = new URL('/api/ad-spend/settle', req.url);
          const settleRes = await fetch(settleUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cronSecret}`,
            },
            body: JSON.stringify({ liveAdId }),
          });

          const settleJson = await settleRes.json().catch(() => null);
          if (!settleRes.ok || !settleJson?.success) {
            settlementError = {
              error: typeof settleJson?.error === 'string' ? settleJson.error : 'SETTLEMENT_FAILED',
              status: settleRes.status,
            };
            console.error('[Meta control] Ad paused, settlement pending', { liveAdId, ...settlementError });
          } else {
            settlement = settleJson;
            console.log('[Meta control] Settlement completed', { liveAdId });
          }
        } catch (error) {
          settlementError = { error: 'SETTLEMENT_REQUEST_FAILED' };
          console.error('[Meta control] Ad paused, settlement request failed', {
            liveAdId,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // 6) Update Nettmark DB status (+ try optional billing fields)
    const nowIso = new Date().toISOString();

    const extendedUpdate: Record<string, any> = {
      status: localStatus,
    };

    if (action === 'PAUSE' && controlActor === 'business') {
      extendedUpdate.billing_state = 'TERMINATED_BY_BUSINESS';
      extendedUpdate.billing_paused_at = nowIso;
      extendedUpdate.terminated_by_business_at = nowIso;
    } else if (action === 'PAUSE') {
      extendedUpdate.billing_state = 'PAUSED';
      extendedUpdate.billing_paused_at = nowIso;
      extendedUpdate.terminated_by_business_at = null;
    } else if (action === 'ARCHIVE') {
      extendedUpdate.billing_state = 'ARCHIVED';
      extendedUpdate.billing_paused_at = nowIso;
    } else if (action === 'RESUME') {
      extendedUpdate.billing_state = 'ACTIVE';
      extendedUpdate.billing_paused_at = null;
      extendedUpdate.terminated_by_business_at = null;
    }

    const extUpdateRes = await supabase
      .from('live_ads')
      .update(extendedUpdate)
      .eq('id', liveAdId);

    let localBillingSyncError: string | null = null;
    if (extUpdateRes.error) {
      console.error('[Meta control] Full local status update failed', { liveAdId, code: extUpdateRes.error.code });
      localBillingSyncError = 'LOCAL_BILLING_STATUS_SYNC_FAILED';

      const { error: fallbackErr } = await supabase
        .from('live_ads')
        .update({ status: localStatus })
        .eq('id', liveAdId);

      if (fallbackErr) {
        console.error('[Meta control] Local status fallback failed', { liveAdId, code: fallbackErr.code });
        return NextResponse.json({
          success: false,
          error: 'LOCAL_STATUS_SYNC_FAILED',
          metaUpdated: true,
          settlementError,
        }, { status: 502 });
      }
    }

    return NextResponse.json({
      success: true,
      warning: localBillingSyncError || (settlementError ? 'SETTLEMENT_PENDING' : null),
      newStatus: localStatus,
      billing_state: extendedUpdate.billing_state ?? null,
      terminated_by_business_at: extendedUpdate.terminated_by_business_at ?? null,
      meta: { targetType, targetId, targetStatus, response: metaJson },
      settlement: settlementError ? null : settlement,
      settlementError,
      settlementSkipped: false,
    });
  } catch (err) {
    console.error('[❌ control-ad route error]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
