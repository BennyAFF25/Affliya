import { settlementExclusionReason, settleStoppedAdSpend } from "../../../../utils/adSpend/settlements";
import { enqueueSafely } from "../../../../utils/email/notificationOutbox";
import { settlementQuote, settlementAud } from '../../../../utils/adSpend/settlementFx';
import { tryWriteMoneyFlowAudit } from "../../../../utils/moneyFlowAudit";
import { getFundingCoverage } from "../../../../utils/adSpend/fundingCoverage";
import { shouldPauseForFunding } from "../../../../utils/adSpend/pauseGuardrail";
// app/api/meta/sync-active-ads/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdSpendSettlementConfig, getAdSpendFundingSnapshot } from '@/../utils/adSpend/settlements';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_API_VERSION = 'v21.0';

type LiveAdRow = {
  id: string;
  status: string | null;
  billing_state?: string | null;
  terminated_by_business_at?: string | null;
  offer_id: string | null;
  ad_idea_id?: string | null;
  meta_campaign_id?: string | null;
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
  auto_paused?: boolean;
  error?: any;
};

type SettlementResult = {
  attempted: boolean;
  success: boolean;
  status?: number;
  chargedAmount?: number;
  transferredAfter?: number;
  unpaidAfter?: number;
  message?: string;
  error?: any;
  raw?: any;
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

  // settlement
  wouldSettle?: boolean;
  settlement?: SettlementResult;

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
  affiliateEmail: string;
  available: number;
  unpaid: number;
  buffer: number;
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

  await tryWriteMoneyFlowAudit(supabase as never, {
    eventType: "campaign_pause_reason", sourceRoute: "/api/meta/sync-active-ads",
    liveAdId, businessEmail, affiliateEmail: params.affiliateEmail,
    reasonCode: "LOW_FUNDS", message: "Funding guardrail paused this campaign.",
    metadata: { available: params.available, unpaid: params.unpaid, buffer: params.buffer, currency: "AUD", paused_at: nowIso },
  });
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
    .select('*')
    .or('status.in.(active,live,ACTIVE,LIVE,paused,PAUSED,archived,ARCHIVED,stopped,STOPPED,ended,ENDED,completed,COMPLETED,deleted,DELETED),billing_state.eq.TERMINATED_BY_BUSINESS,terminated_by_business_at.not.is.null');

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
  const settleEndpoint = `${origin}/api/ad-spend/settle`;
  const transferBatchEndpoint = `${origin}/api/ad-spend/process-transfer-batches`;
  const cronSecret = process.env.CRON_SECRET!;
  const settlementConfig = getAdSpendSettlementConfig();

  const perAd: PerAdResult[] = [];
  let autoPausedCount = 0;
  let shouldKickTransferProcessor = false;

  // Keep batch small to reduce Meta/API spikes
  const batches = chunk(ads, 5);

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (ad): Promise<PerAdResult> => {
        const liveAdId = ad.id;

        const stopped = ad.billing_state === 'TERMINATED_BY_BUSINESS' || !!ad.terminated_by_business_at ||
          !['active', 'live'].includes((ad.status || '').toLowerCase());
        const exclusion = settlementExclusionReason(ad, stopped ? 'stranded_recovery' : 'threshold_settlement', stopped);
        if (exclusion) return { liveAdId, ok: true, wouldSettle: false,
          settlement: { attempted: false, success: false, message: exclusion } };
        if (stopped) {
          const unpaid = Math.max(0, num(ad.spend) - num(ad.spend_transferred));
          // Also retry final hold release on already-settled terminal rows.
          if (dryRun) return { liveAdId, ok: true, unpaid, wouldSettle: unpaid > 0 };
          const result = await settleStoppedAdSpend({ supabase: supabase as never, liveAdId,
            status: ad.billing_state === 'TERMINATED_BY_BUSINESS' || ad.terminated_by_business_at ? 'stopped' : ad.status || 'stopped',
            adIdeaId: ad.ad_idea_id });
          shouldKickTransferProcessor ||= result.chargedAmount > 0;
          return { liveAdId, ok: result.success && !result.error, unpaid,
            settlement: { attempted: true, ...result } };
        }

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
        let insightsAutoPaused = false;
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

            insightsAutoPaused = first?.auto_paused === true;
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

        // 2c) Use the same wallet + reserved starter funding as settlement.
        const affiliateEmail = ad.affiliate_email;

        let walletAvailable: number;

        try {
          const walletSnapshot = await getAdSpendFundingSnapshot(supabase as never, { offerId: ad.offer_id || "", businessEmail: ad.business_email || "", affiliateEmail });
          walletAvailable = walletSnapshot.availableBalance;
        } catch (walletErr) {
          return {
            liveAdId,
            ok: false,
            spend,
            clicks,
            adInsightsStatus,
            error: {
              code: 'CANONICAL_WALLET_SNAPSHOT_FAILED',
              details: walletErr instanceof Error ? walletErr.message : walletErr,
            },
          };
        }

        // 2d) Automated settlement + pause decision
        const quote = await settlementQuote(supabase, liveAdId);
        if (!quote) return { liveAdId, ok: true, spend, unpaid, error: 'FX_SETTLEMENT_DEFERRED' };
        const unpaidAud = quote.fx ? settlementAud(unpaid, quote.fx.rate) : unpaid;
        const meetsChunkThreshold = unpaidAud >= settlementConfig.thresholdAmount;
        const nearWalletEdge = walletAvailable > 0 && walletAvailable - unpaidAud <= settlementConfig.walletBuffer;
        const shouldSettle = unpaid > 0 && walletAvailable > 0 && (meetsChunkThreshold || nearWalletEdge);
        const coverage = await getFundingCoverage(supabase, ad, spend);
        const fundingReserve = Math.max(settlementConfig.walletBuffer, coverage.nextDayBudget);
        const shouldPause = shouldPauseForFunding(walletAvailable, coverage.unpaid, fundingReserve);

        if (dryRun) {
          return {
            liveAdId,
            ok: true,
            spend,
            clicks,
            walletAvailable,
            unpaid,
            wouldSettle: shouldSettle,
            wouldPause: shouldPause,
            settlement: {
              attempted: false,
              success: false,
              message: `threshold=${settlementConfig.thresholdAmount} buffer=${settlementConfig.walletBuffer}`,
            },
          };
        }

        let settlement: SettlementResult = {
          attempted: false,
          success: false,
        };

        if (shouldSettle) {
          try {
            const settleRes = await fetch(settleEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': cronSecret,
                Authorization: `Bearer ${cronSecret}`,
              },
              body: JSON.stringify({ liveAdId }),
            });

            const settleJson = await settleRes.json().catch(() => null);
            const settleOk = !!settleRes.ok && !!settleJson?.success;

            settlement = {
              attempted: true,
              success: settleOk,
              status: settleRes.status,
              chargedAmount:
                typeof settleJson?.chargedAmount === 'number'
                  ? settleJson.chargedAmount
                  : undefined,
              transferredAfter:
                typeof settleJson?.transferredAfter === 'number'
                  ? settleJson.transferredAfter
                  : undefined,
              unpaidAfter:
                typeof settleJson?.unpaidAfter === 'number'
                  ? settleJson.unpaidAfter
                  : undefined,
              message: settleJson?.message || settleJson?.error,
              error: settleOk ? null : settleJson?.error || 'SETTLEMENT_FAILED',
              raw: settleJson,
            };

            shouldKickTransferProcessor = shouldKickTransferProcessor || settleOk;
          } catch (settleErr) {
            settlement = {
              attempted: true,
              success: false,
              error: settleErr instanceof Error ? settleErr.message : settleErr,
            };
          }
        }

        // Settlement deducts wallet principal. Re-read rather than using the pre-debit balance.
        if (settlement.attempted) {
          try {
            walletAvailable = (await getAdSpendFundingSnapshot(supabase as never, { offerId: ad.offer_id || "", businessEmail: ad.business_email || "", affiliateEmail })).availableBalance;
          } catch {
            return { liveAdId, ok: false, spend, clicks, settlement, error: "POST_SETTLEMENT_FUNDING_SNAPSHOT_FAILED" };
          }
        }
        const latestCoverage = await getFundingCoverage(supabase, ad, spend);
        const shouldPauseAfterSettlement = shouldPauseForFunding(walletAvailable, latestCoverage.unpaid, fundingReserve);

        if (insightsAutoPaused) {
          autoPausedCount += 1;
          return { liveAdId, ok: true, spend, walletAvailable, unpaid, settlement, autoPaused: true };
        }
        if (!shouldPauseAfterSettlement) {
          if (walletAvailable > 0 && walletAvailable <= fundingReserve * 2) {
            await enqueueSafely(supabase as never, {
              key: "product:low-balance:" + liveAdId + ":" + new Date().toISOString().slice(0, 10),
              kind: "wallet_low_balance", scope: "product", recipient: affiliateEmail,
              payload: { campaign_id: liveAdId },
            });
          }
          return {
            liveAdId,
            ok: settlement.attempted ? settlement.success : true,
            spend,
            clicks,
            adInsightsStatus,
            walletAvailable,
            unpaid,
            settlement,
            autoPaused: false,
            pauseError: null,
            error: settlement.attempted && !settlement.success ? settlement.error : undefined,
          };
        }

        // Pause in Meta directly (avoid triggering settlement logic in control-ad)
        const pauseRes = await pauseMetaAdAndUpdateLocal({
          liveAdId,
          metaAdId: ad.meta_ad_id,
          businessEmail: ad.business_email,
          affiliateEmail, available: walletAvailable, unpaid: latestCoverage.unpaid, buffer: fundingReserve,
        });

        if (!pauseRes.ok) {
          return {
            liveAdId,
            ok: false, // A failed protective pause must be visible to operators
            spend,
            clicks,
            adInsightsStatus,
            walletAvailable,
            unpaid,
            settlement,
            autoPaused: false,
            pauseError: pauseRes.error,
          };
        }

        autoPausedCount += 1;

        const pauseEventKey = "product:low-funds-pause:" + liveAdId + ":" + new Date().toISOString().slice(0, 13);
        await enqueueSafely(supabase as never, {
          key: pauseEventKey, kind: "campaign_auto_paused",
          scope: "product", recipient: affiliateEmail, payload: { campaign_id: liveAdId },
        });
        await enqueueSafely(supabase as never, {
          key: pauseEventKey, kind: "campaign_auto_paused_business",
          scope: "product", recipient: ad.business_email, payload: { campaign_id: liveAdId },
        });

        return {
          liveAdId,
          ok: true,
          spend,
          clicks,
          adInsightsStatus,
          walletAvailable,
          unpaid,
          settlement,
          autoPaused: true,
          pauseError: null,
        };
      })
    );

    perAd.push(...batchResults);
  }

  if (!dryRun && shouldKickTransferProcessor) {
    try {
      await fetch(transferBatchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ limitBusinesses: 10 }),
      });
    } catch (batchErr) {
      console.error('[sync-active-ads] transfer batch trigger failed', batchErr);
    }
  }

  const okCount = perAd.filter((r) => r.ok).length;
  const failedCount = perAd.length - okCount;
  const settledCount = perAd.filter((r) => r.settlement?.success).length;
  const settlementFailedCount = perAd.filter(
    (r) => r.settlement?.attempted && !r.settlement?.success,
  ).length;

  return NextResponse.json({
    success: true,
    dryRun,
    total: perAd.length,
    ok: okCount,
    failed: failedCount,
    settled: dryRun ? 0 : settledCount,
    settlementFailed: dryRun ? 0 : settlementFailedCount,
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