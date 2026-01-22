// app/api/meta/ad-insights/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_API_VERSION = 'v21.0';

type SyncResult = {
  liveAdId: string;
  meta_ad_id?: string | null;
  spend?: number;
  clicks?: number;
  ok: boolean;
  error?: any;

  // Extra debug fields (safe to include; UI can ignore)
  spend_transferred?: number;
  unpaid?: number;
  wallet_available?: number;
  auto_paused?: boolean;
  auto_pause_reason?: string;
  auto_pause_meta_result?: any;
  auto_pause_db_updated?: boolean;
};

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));

    const liveAdIdSingle = body?.liveAdId || body?.live_ad_id;
    const liveAdIds: string[] = Array.isArray(body?.liveAdIds)
      ? body.liveAdIds
      : liveAdIdSingle
        ? [liveAdIdSingle]
        : [];

    console.log('[🔎 ad-insights] request body', {
      live_ad_id: liveAdIdSingle,
      keys: Object.keys(body || {}),
      count: liveAdIds.length,
    });

    if (!liveAdIds.length) {
      return NextResponse.json(
        { success: false, error: 'MISSING_LIVE_AD_ID' },
        { status: 400 }
      );
    }

    const results: SyncResult[] = [];

    for (const liveAdId of liveAdIds) {
      try {
        // 1) Load live_ads row (need meta_ad_id + business_email + affiliate_email + spend_transferred + status)
        const { data: ad, error: adErr } = await supabase
          .from('live_ads')
          .select('id, meta_ad_id, business_email, affiliate_email, spend_transferred, status')
          .eq('id', liveAdId)
          .single();

        if (adErr || !ad) {
          console.error('[❌ ad-insights] live_ads lookup failed', {
            liveAdId,
            adErr,
          });
          results.push({ liveAdId, ok: false, error: 'LIVE_AD_NOT_FOUND' });
          continue;
        }

        const meta_ad_id = (ad as any).meta_ad_id as string | null;
        const business_email = (ad as any).business_email as string | null;
        const affiliate_email = (ad as any).affiliate_email as string | null;

        const statusLocal = String((ad as any).status || '').toLowerCase();
        const spendTransferredInitial = toNum((ad as any).spend_transferred);

        if (!meta_ad_id || !business_email) {
          console.error('[❌ ad-insights] Missing meta_ad_id or business_email', {
            liveAdId,
            meta_ad_id,
            business_email,
          });
          results.push({
            liveAdId,
            meta_ad_id,
            ok: false,
            error: 'MISSING_META_IDS',
          });
          continue;
        }

        // 2) Get latest Meta connection token for this business
        const { data: metaConn, error: metaErr } = await supabase
          .from('meta_connections')
          .select('access_token, id, created_at')
          .eq('business_email', business_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (metaErr || !metaConn?.access_token) {
          console.error('[❌ ad-insights] meta_connections lookup failed', {
            liveAdId,
            business_email,
            metaErr,
          });
          results.push({
            liveAdId,
            meta_ad_id,
            ok: false,
            error: 'META_CONNECTION_NOT_FOUND',
          });
          continue;
        }

        // 3) Fetch Meta insights (use MAXIMUM – lifetime was removed)
        const endpoint =
          `https://graph.facebook.com/${META_API_VERSION}/${meta_ad_id}` +
          `/insights?fields=spend,clicks,actions&date_preset=maximum&access_token=${encodeURIComponent(
            metaConn.access_token
          )}`;

        console.log('[➡️ ad-insights] GET', {
          live_ad_id: liveAdId,
          meta_ad_id,
          metaConnectionId: metaConn.id,
          endpoint: endpoint.replace(metaConn.access_token, '***'),
        });

        const t0 = Date.now();
        const insightsRes = await fetch(endpoint, { method: 'GET' });
        const insights = await insightsRes.json().catch(() => ({}));
        const took_ms = Date.now() - t0;

        console.log('[📊 Meta Insights Response]', JSON.stringify(insights, null, 2));

        if (!insightsRes.ok || (insights as any)?.error) {
          const meta_error = (insights as any)?.error;
          console.error('[❌ ad-insights] Meta insights failed', {
            live_ad_id: liveAdId,
            meta_ad_id,
            status: insightsRes.status,
            took_ms,
            meta_error,
            raw: insights,
          });

          results.push({
            liveAdId,
            meta_ad_id,
            ok: false,
            error: { status: insightsRes.status, meta_error, raw: insights },
          });
          continue;
        }

        const spend =
          Number.parseFloat((insights as any)?.data?.[0]?.spend || '0') || 0;
        const clicks =
          Number.parseInt((insights as any)?.data?.[0]?.clicks || '0', 10) || 0;

        // 4) Overwrite live_ads spend/clicks (source of truth = Meta totals)
        const { error: updateErr } = await supabase
          .from('live_ads')
          .update({ spend, clicks })
          .eq('id', liveAdId);

        if (updateErr) {
          console.error('[❌ ad-insights] Failed to update live_ads', {
            live_ad_id: liveAdId,
            meta_ad_id,
            spend,
            clicks,
            updateErr,
          });
          results.push({
            liveAdId,
            meta_ad_id,
            ok: false,
            error: 'DB_UPDATE_FAILED',
          });
          continue;
        }

        console.log('[✅ ad-insights] Updated live_ads spend/clicks', {
          live_ad_id: liveAdId,
          meta_ad_id,
          spend,
          clicks,
        });

        // =========================
        // STEP 5: Auto-pause guard
        // =========================
        // Prevent debt by pausing if wallet cannot cover unpaid spend.
        // We do NOT settle here — settlement is handled on manual pause/stop via control-ad,
        // and settle will fail anyway if the wallet is short. This block is purely "stop the bleeding".
        let autoPaused = false;
        let autoPauseReason: string | null = null;
        let autoPauseMetaResult: any = null;
        let autoPauseDbUpdated = false;

        // Only consider auto-pause if we have an affiliate email and the campaign isn't already paused/archived.
        const alreadyPausedLike =
          statusLocal === 'paused' ||
          statusLocal === 'archived' ||
          statusLocal === 'deleted';

        // Re-fetch spend_transferred + status for freshest guardrail (avoid stale data if a settle happened recently)
        const { data: freshRow } = await supabase
          .from('live_ads')
          .select('spend_transferred, status')
          .eq('id', liveAdId)
          .maybeSingle();

        const spendTransferredNow = toNum(freshRow?.spend_transferred ?? spendTransferredInitial);
        const localStatusNow = String(freshRow?.status ?? statusLocal).toLowerCase();

        const unpaid = Math.max(0, toNum(spend) - spendTransferredNow);

        // Calculate wallet available: sum(topups net - refunded) - sum(deductions)
        let walletAvailable = 0;

        if (affiliate_email && !alreadyPausedLike && unpaid > 0) {
          // Topups (amount_net - amount_refunded)
          const { data: topups, error: topupErr } = await supabase
            .from('wallet_topups')
            .select('amount_net, amount_refunded, status')
            .eq('affiliate_email', affiliate_email)
            .eq('status', 'succeeded');

          if (topupErr) {
            console.error('[❌ ad-insights] wallet_topups lookup failed', {
              liveAdId,
              affiliate_email,
              topupErr,
            });
          }

          const totalTopups = (topups || []).reduce((sum: number, t: any) => {
            const net = toNum(t?.amount_net);
            const refunded = toNum(t?.amount_refunded);
            return sum + Math.max(0, net - refunded);
          }, 0);

          const { data: deductions, error: dedErr } = await supabase
            .from('wallet_deductions')
            .select('amount')
            .eq('affiliate_email', affiliate_email);

          if (dedErr) {
            console.error('[❌ ad-insights] wallet_deductions lookup failed', {
              liveAdId,
              affiliate_email,
              dedErr,
            });
          }

          const totalDeductions = (deductions || []).reduce(
            (sum: number, d: any) => sum + toNum(d?.amount),
            0
          );

          walletAvailable = totalTopups - totalDeductions;

          console.log('[👛 Auto-pause check]', {
            liveAdId,
            affiliate_email,
            spend,
            spendTransferredNow,
            unpaid,
            walletAvailable,
            localStatusNow,
          });

          // Trigger: wallet cannot cover unpaid OR wallet is basically empty
          if (walletAvailable <= 0 || walletAvailable < unpaid) {
            autoPauseReason = 'INSUFFICIENT_WALLET_FOR_UNPAID_SPEND';

            // Pause the Meta ad immediately (stop spend)
            const pauseUrl = `https://graph.facebook.com/${META_API_VERSION}/${meta_ad_id}?access_token=${encodeURIComponent(
              metaConn.access_token
            )}`;

            console.log('[⛔ Auto-pause] POST', pauseUrl, {
              liveAdId,
              meta_ad_id,
              status: 'PAUSED',
              reason: autoPauseReason,
            });

            const pauseRes = await fetch(pauseUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ status: 'PAUSED' }),
            });

            autoPauseMetaResult = await pauseRes.json().catch(() => ({}));

            if (!pauseRes.ok || (autoPauseMetaResult as any)?.error) {
              console.error('[❌ Auto-pause Meta failed]', {
                liveAdId,
                meta_ad_id,
                status: pauseRes.status,
                autoPauseMetaResult,
              });
            } else {
              console.log('[✅ Auto-pause Meta success]', {
                liveAdId,
                meta_ad_id,
                autoPauseMetaResult,
              });

              autoPaused = true;

              // Update local DB status (and try to set billing fields if they exist; fallback to status-only)
              const nowIso = new Date().toISOString();
              const extendedUpdate: Record<string, any> = {
                status: 'paused',
                billing_state: 'PAUSED_LOW_WALLET',
                billing_paused_at: nowIso,
              };

              const ext = await supabase
                .from('live_ads')
                .update(extendedUpdate)
                .eq('id', liveAdId);

              if (ext.error) {
                console.warn(
                  '[⚠️ Auto-pause extended live_ads update failed — falling back to status-only]',
                  ext.error
                );
                const fb = await supabase
                  .from('live_ads')
                  .update({ status: 'paused' })
                  .eq('id', liveAdId);

                if (fb.error) {
                  console.error('[❌ Auto-pause status-only update failed]', fb.error);
                } else {
                  autoPauseDbUpdated = true;
                }
              } else {
                autoPauseDbUpdated = true;
              }
            }
          }
        }

        results.push({
          liveAdId,
          meta_ad_id,
          spend,
          clicks,
          ok: true,
          spend_transferred: spendTransferredNow,
          unpaid,
          wallet_available: walletAvailable,
          auto_paused: autoPaused,
          auto_pause_reason: autoPauseReason || undefined,
          auto_pause_meta_result: autoPauseMetaResult || undefined,
          auto_pause_db_updated: autoPauseDbUpdated,
        });
      } catch (innerErr: any) {
        console.error('[❌ ad-insights] Unhandled per-ad error', {
          liveAdId,
          innerErr,
        });
        results.push({
          liveAdId,
          ok: false,
          error: innerErr?.message || innerErr,
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    console.log('[📢 ad-insights] done', {
      total: results.length,
      ok: okCount,
      failed: results.length - okCount,
      took_ms: Date.now() - startedAt,
    });

    const anyFailed = results.some((r) => !r.ok);

    return NextResponse.json(
      {
        success: !anyFailed,
        results,
        meta: {
          note: 'Meta no longer accepts date_preset=lifetime. Using date_preset=maximum.',
          autopause_note:
            'Auto-pause runs after spend sync. It pauses ads if wallet cannot cover unpaid spend (spend - spend_transferred).',
        },
      },
      { status: anyFailed ? 207 : 200 }
    );
  } catch (err: any) {
    console.error('[❌ ad-insights] Unhandled route error', err);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', details: err?.message || err },
      { status: 500 }
    );
  }
}