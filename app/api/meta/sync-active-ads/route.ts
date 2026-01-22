// app/api/meta/sync-active-ads/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_API_VERSION = 'v21.0';

type LiveAdRow = {
  id: string;
  status: string | null;
  meta_ad_id: string | null;
  business_email: string | null;
  affiliate_email: string | null;
  spend: number | string | null;
  spend_transferred: number | string | null;
};

type AdInsightsResult = {
  liveAdId: string;
  meta_ad_id?: string | null;
  spend?: number;
  clicks?: number;
  ok: boolean;
  error?: any;
};

type PerAdResult = {
  liveAdId: string;
  ok: boolean;

  // spend sync
  spend?: number;
  clicks?: number;
  adInsightsStatus?: number;

  // wallet guardrail
  walletAvailable?: number;
  unpaid?: number;

  // pause outcome
  wouldPause?: boolean; // dryRun only
  autoPaused?: boolean; // actual run
  pauseError?: any;

  error?: any;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function num(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function getDryRunFromRequest(req: Request): boolean {
  // GET: /api/meta/sync-active-ads?dryRun=true
  const url = new URL(req.url);
  const qp = url.searchParams.get('dryRun');
  if (qp !== null) {
    return qp === '1' || qp.toLowerCase() === 'true';
  }
  return false;
}

function isAuthorized(req: Request): { ok: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[sync-active-ads] Missing CRON_SECRET env var');
    return { ok: false, error: 'SERVER_MISCONFIGURED' };
  }

  // Vercel Cron uses Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  const xCron = req.headers.get('x-cron-secret'); // keep for local testing

  const ok =
    authHeader === `Bearer ${cronSecret}` ||
    xCron === cronSecret;

  if (!ok) return { ok: false, error: 'UNAUTHORIZED' };
  return { ok: true };
}

async function pauseMetaAdAndUpdateLocal(params: {
  liveAdId: string;
  metaAdId: string;
  businessEmail: string;
}) {
  const { liveAdId, metaAdId, businessEmail } = params;

  // 1) Fetch latest token
  const { data: metaConn, error: metaErr } = await supabase
    .from('meta_connections')
    .select('access_token, id, created_at')
    .eq('business_email', businessEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (metaErr || !metaConn?.access_token) {
    return {
      ok: false,
      error: {
        code: 'META_CONNECTION_NOT_FOUND',
        details: metaErr || null,
      },
    };
  }

  const accessToken = metaConn.access_token as string;

  // 2) Pause the Meta ad
  const url = `https://graph.facebook.com/${META_API_VERSION}/${metaAdId}?access_token=${encodeURIComponent(
    accessToken
  )}`;

  const metaRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'PAUSED' }),
  });

  const metaJson = await metaRes.json().catch(() => ({}));

  if (!metaRes.ok || (metaJson as any)?.error) {
    return {
      ok: false,
      error: {
        code: 'META_CONTROL_FAILED',
        status: metaRes.status,
        details: metaJson,
      },
    };
  }

  // 3) Update local status (try extended fields, fallback to status-only)
  const nowIso = new Date().toISOString();

  const extendedUpdate: Record<string, any> = {
    status: 'paused',
    billing_state: 'PAUSED',
    billing_paused_at: nowIso,
  };

  const extRes = await supabase
    .from('live_ads')
    .update(extendedUpdate)
    .eq('id', liveAdId);

  if (extRes.error) {
    // likely missing columns in schema — fall back
    const fb = await supabase
      .from('live_ads')
      .update({ status: 'paused' })
      .eq('id', liveAdId);

    if (fb.error) {
      return {
        ok: false,
        error: {
          code: 'LOCAL_STATUS_UPDATE_FAILED',
          details: fb.error,
        },
      };
    }
  }

  return { ok: true };
}

async function run(req: Request) {
  const startedAt = Date.now();

  // 0) Auth
  const auth = isAuthorized(req);
  if (!auth.ok) {
    const status = auth.error === 'SERVER_MISCONFIGURED' ? 500 : 401;
    return NextResponse.json(
      { success: false, error: auth.error },
      { status }
    );
  }

  // dryRun from GET query OR POST body
  let dryRun = getDryRunFromRequest(req);

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.dryRun === 'boolean') dryRun = body.dryRun;
    if (typeof body?.dryRun === 'number') dryRun = !!body.dryRun;
  }

  // 1) Pull active/live Meta ads (include both lowercase + uppercase)
  const { data: rows, error: listErr } = await supabase
    .from('live_ads')
    .select('id, status, meta_ad_id, business_email, affiliate_email, spend, spend_transferred')
    .in('status', ['active', 'live', 'ACTIVE', 'LIVE'])
    .not('meta_ad_id', 'is', null);

  if (listErr) {
    console.error('[sync-active-ads] live_ads list error', listErr);
    return NextResponse.json(
      { success: false, error: 'DB_LIST_FAILED', details: listErr },
      { status: 500 }
    );
  }

  const ads: LiveAdRow[] = (rows || []) as any;

  if (!ads.length) {
    return NextResponse.json({
      success: true,
      dryRun,
      message: 'No active/live Meta ads found.',
      total: 0,
      ok: 0,
      failed: 0,
      autoPaused: 0,
      results: [],
      took_ms: Date.now() - startedAt,
    });
  }

  // 2) Call /api/meta/ad-insights for each live ad (small batches)
  const origin = new URL(req.url).origin;
  const insightsEndpoint = `${origin}/api/meta/ad-insights`;
  const cronSecret = process.env.CRON_SECRET!;

  const perAd: PerAdResult[] = [];
  let autoPausedCount = 0;

  // Keep batch small to reduce Meta/API spikes
  const batches = chunk(ads, 5);

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (ad): Promise<PerAdResult> => {
        const liveAdId = ad.id;

        // Basic guards
        if (!ad.business_email || !ad.affiliate_email || !ad.meta_ad_id) {
          return {
            liveAdId,
            ok: false,
            error: 'MISSING_REQUIRED_FIELDS_ON_LIVE_AD',
          };
        }

        // 2a) Sync spend/clicks (unless dryRun)
        let spend = num(ad.spend);
        let clicks: number | undefined = undefined;
        let adInsightsStatus: number | undefined = undefined;

        if (!dryRun) {
          try {
            const res = await fetch(insightsEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // pass through in case you protect other internal routes later
                'x-cron-secret': cronSecret,
                Authorization: `Bearer ${cronSecret}`,
              },
              body: JSON.stringify({ liveAdId }),
            });

            adInsightsStatus = res.status;
            const json = await res.json().catch(() => null);

            // ad-insights returns: { success, results: SyncResult[] }
            const first: AdInsightsResult | null = Array.isArray(json?.results)
              ? json.results[0]
              : null;

            const ok = !!json?.success && !!first?.ok;

            if (!res.ok || !ok) {
              return {
                liveAdId,
                ok: false,
                adInsightsStatus,
                error: json || { error: 'AD_INSIGHTS_FAILED' },
              };
            }

            if (typeof first?.spend === 'number') spend = first.spend;
            if (typeof first?.clicks === 'number') clicks = first.clicks;
          } catch (e: any) {
            return {
              liveAdId,
              ok: false,
              error: e?.message || e,
            };
          }
        }

        // 2b) Compute unpaid (spend - spend_transferred)
        const transferred = num(ad.spend_transferred);
        const unpaid = Math.max(0, spend - transferred);

        // 2c) Compute wallet available (topups - deductions)
        const affiliateEmail = ad.affiliate_email;

        const { data: topups, error: topErr } = await supabase
          .from('wallet_topups')
          .select('amount_net')
          .eq('affiliate_email', affiliateEmail)
          .eq('status', 'succeeded');

        if (topErr) {
          return {
            liveAdId,
            ok: false,
            spend,
            clicks,
            adInsightsStatus,
            error: { code: 'WALLET_TOPUPS_READ_FAILED', details: topErr },
          };
        }

        const totalTopups =
          (topups || []).reduce((sum, r: any) => sum + num(r.amount_net), 0) || 0;

        const { data: deductions, error: dedErr } = await supabase
          .from('wallet_deductions')
          .select('amount')
          .eq('affiliate_email', affiliateEmail);

        if (dedErr) {
          return {
            liveAdId,
            ok: false,
            spend,
            clicks,
            adInsightsStatus,
            error: { code: 'WALLET_DEDUCTIONS_READ_FAILED', details: dedErr },
          };
        }

        const totalDeductions =
          (deductions || []).reduce((sum, r: any) => sum + num(r.amount), 0) || 0;

        const walletAvailable = totalTopups - totalDeductions;

        // 2d) Guardrail: if wallet can’t cover unpaid spend, pause the ad
        const shouldPause = walletAvailable < unpaid;

        if (dryRun) {
          return {
            liveAdId,
            ok: true,
            spend,
            clicks,
            walletAvailable,
            unpaid,
            wouldPause: shouldPause,
          };
        }

        if (!shouldPause) {
          return {
            liveAdId,
            ok: true,
            spend,
            clicks,
            adInsightsStatus,
            walletAvailable,
            unpaid,
            autoPaused: false,
            pauseError: null,
          };
        }

        // Pause in Meta directly (avoid triggering settlement logic in control-ad)
        const pauseRes = await pauseMetaAdAndUpdateLocal({
          liveAdId,
          metaAdId: ad.meta_ad_id,
          businessEmail: ad.business_email,
        });

        if (!pauseRes.ok) {
          return {
            liveAdId,
            ok: true, // sync still worked; pause failed separately
            spend,
            clicks,
            adInsightsStatus,
            walletAvailable,
            unpaid,
            autoPaused: false,
            pauseError: pauseRes.error,
          };
        }

        autoPausedCount += 1;

        return {
          liveAdId,
          ok: true,
          spend,
          clicks,
          adInsightsStatus,
          walletAvailable,
          unpaid,
          autoPaused: true,
          pauseError: null,
        };
      })
    );

    perAd.push(...batchResults);
  }

  const okCount = perAd.filter((r) => r.ok).length;
  const failedCount = perAd.length - okCount;

  return NextResponse.json({
    success: true,
    dryRun,
    total: perAd.length,
    ok: okCount,
    failed: failedCount,
    autoPaused: dryRun ? 0 : autoPausedCount,
    results: perAd,
    took_ms: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}