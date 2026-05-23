import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isUuid, resolveRuntimeCampaign } from '@/../utils/tracking/campaignIdentity';
import { quarantineBillableEvent } from '@/../utils/tracking/quarantine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function corsHeaders(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && origin !== 'null' ? origin : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  } as const;
}

function jsonWithCors(req: NextRequest, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(req.headers.get('origin') || req.headers.get('Origin')),
      ...(init?.headers || {}),
    },
  });
}

function toNum(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractAmountAndCurrency(data: any): { amount: number | null; currency: string | null } {
  if (!data || typeof data !== 'object') return { amount: null, currency: null };

  let amount: number | null = null;
  let currency: string | null = null;

  // 1) Shopify style: totalPrice: { amount, currencyCode }
  if (data.totalPrice) {
    amount = toNum(data.totalPrice.amount);
    if (typeof data.totalPrice.currencyCode === 'string') {
      currency = data.totalPrice.currencyCode.toLowerCase();
    }
  }

  // 2) Common direct fields
  if (amount == null) {
    const candidates = [
      data.amount,
      data.total,
      data.value,
      data.price,
      data.order_total,
      data.total_price,
      data.current_total_price,
      data.subtotal_price,
      data.total_line_items_price,
    ];
    for (const c of candidates) {
      const n = toNum(c);
      if (n != null) {
        amount = n;
        break;
      }
    }
  }

  if (!currency) {
    const currencyCandidates = [
      data.currency,
      data.currencyCode,
      data?.totalPrice?.currencyCode,
    ];
    for (const cur of currencyCandidates) {
      if (typeof cur === 'string' && cur.trim()) {
        currency = cur.toLowerCase();
        break;
      }
    }
  }

  return { amount, currency };
}

function hostnameFrom(event_data: any, fallbackRef?: string | null): string | null {
  try {
    const raw = (event_data?.url || event_data?.page_url || event_data?.location || fallbackRef || '').toString();
    if (!raw) return null;
    const h = new URL(raw).hostname.toLowerCase();
    return h.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function queryParamFromUrl(rawUrl: unknown, key: string): string | null {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;

  try {
    const parsed = new URL(rawUrl);
    const value = parsed.searchParams.get(key);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function nestedRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function resolveAffiliateAndCampaign(body: Record<string, any>, eventData: Record<string, any>) {
  const context = nestedRecord(eventData.context);
  const contextDocument = nestedRecord(context?.document);
  const page = nestedRecord(eventData.page);

  const candidateUrls = [
    body.url,
    body.page_url,
    body.location,
    eventData.url,
    eventData.page_url,
    eventData.location,
    page?.url,
    contextDocument?.location?.href,
    contextDocument?.referrer,
    body.referrer,
  ];

  const affiliateId = firstText(
    body.affiliate_id,
    eventData.affiliate_id,
    eventData.affiliateId,
    eventData.nm_aff,
    ...candidateUrls.map((url) => queryParamFromUrl(url, 'nm_aff')),
  );

  const campaignId = firstText(
    body.campaign_id,
    eventData.campaign_id,
    eventData.campaignId,
    eventData.nm_camp,
    ...candidateUrls.map((url) => queryParamFromUrl(url, 'nm_camp')),
  );

  return { affiliateId, campaignId };
}

function normalizeEventType(rawEventType: unknown, hasBillableIdentity: boolean, amount: number | null) {
  const raw = typeof rawEventType === 'string' ? rawEventType.trim().toLowerCase() : '';

  if (raw === 'page_viewed' || raw === 'pageview') return 'page_view';
  if (raw === 'add_to_cart') return 'add_to_cart';
  if (raw === 'cart_updated') return 'cart_updated';
  if (raw === 'checkout_completed') {
    return hasBillableIdentity && amount != null ? 'conversion' : 'checkout_completed';
  }

  return raw || 'unknown';
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin') || req.headers.get('Origin')),
  });
}

export async function POST(req: NextRequest) {
  try {
    // Support both JSON and text/plain from sendBeacon/fetch
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else {
      const text = await req.text();
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    const rawEventType = body.event_type;
    if (!rawEventType) {
      return jsonWithCors(req, { error: 'event_type required' }, { status: 400 });
    }

    const raw_event_data = body.event_data;
    const event_data =
      raw_event_data && typeof raw_event_data === 'object'
        ? raw_event_data
        : {};

    const resolvedAttribution = resolveAffiliateAndCampaign(body, event_data);
    const affiliate_id = resolvedAttribution.affiliateId;
    let campaign_id = resolvedAttribution.campaignId;
    let offer_id = body.offer_id ?? body?.event_data?.offer_id ?? null;
    const { amount, currency } = extractAmountAndCurrency(event_data);
    const event_type = normalizeEventType(
      rawEventType,
      !!(affiliate_id && campaign_id),
      amount,
    );
    const isBillableEvent = event_type === 'conversion';

    console.log('[track-event] incoming event', {
      raw_event_type: rawEventType,
      event_type,
      affiliate_id,
      campaign_id,
      offer_id_raw: body.offer_id ?? null,
      campaign_id_raw: body.campaign_id ?? null,
    });

    if (rawEventType !== event_type && !event_data.original_event_type) {
      event_data.original_event_type = rawEventType;
    }

    const strictRuntimeCampaign = campaign_id
      ? await resolveRuntimeCampaign(supabase as any, {
          campaignId: campaign_id,
          affiliateEmail: affiliate_id,
        })
      : null;

    if (isBillableEvent) {
      if (!strictRuntimeCampaign) {
        await quarantineBillableEvent(supabase as any, {
          sourceRoute: 'app/api/track-event/route.ts',
          reasonCode: 'INVALID_BILLABLE_CAMPAIGN_IDENTITY',
          message:
            'Billable conversion event could not be resolved to an exact runtime campaign identity.',
          eventType: event_type,
          rawCampaignId: campaign_id,
          affiliateId: affiliate_id,
          rawPayload: {
            event_type,
            affiliate_id,
            campaign_id,
            offer_id,
            event_data,
          },
        });

        return jsonWithCors(
          req,
          {
            ok: false,
            error: 'INVALID_BILLABLE_CAMPAIGN_IDENTITY',
            message:
              'Billable conversion events must resolve to an exact runtime campaign identity. Hostname and offer fallbacks are not allowed.',
          },
          { status: 400 },
        );
      }

      campaign_id = strictRuntimeCampaign.campaignId;
      offer_id = strictRuntimeCampaign.offerId;
    }

    // --- Offer ID Fallback Logic ---
    if (!isBillableEvent && !offer_id && campaign_id) {
      // 0) PRIMARY: resolve via live_campaigns (authoritative mapping from runtime campaign → offer)
      const { data: liveCamp, error: liveCampErr } = await supabase
        .from('live_campaigns')
        .select('offer_id')
        .eq('id', campaign_id)
        .maybeSingle();

      if (!liveCampErr && liveCamp?.offer_id) {
        offer_id = liveCamp.offer_id;
        console.log(`[track-event] [fallback] offer_id via live_campaigns → ${offer_id}`);
      } else {
        // 1) Try resolve via ad_ideas (older path for campaigns created from ad ideas)
        const { data: adIdea, error: adErr } = await supabase
          .from('ad_ideas')
          .select('offer_id')
          .eq('campaign_id', campaign_id)
          .maybeSingle();

        if (!adErr && adIdea?.offer_id) {
          offer_id = adIdea.offer_id;
          console.log(`[track-event] [fallback] offer_id via ad_ideas → ${offer_id}`);
        } else {
          // 2) Secondary fallback via live_ads if present
          const { data: liveAd, error: liveErr } = await supabase
            .from('live_ads')
            .select('offer_id')
            .eq('campaign_id', campaign_id)
            .maybeSingle();

          if (!liveErr && liveAd?.offer_id) {
            offer_id = liveAd.offer_id;
            console.log(`[track-event] [fallback] offer_id via live_ads → ${offer_id}`);
          } else {
            // 3) Tertiary fallback via organic_posts if present
            const { data: organicPost, error: organicErr } = await supabase
              .from('organic_posts')
              .select('offer_id')
              .eq('campaign_id', campaign_id)
              .maybeSingle();

            if (!organicErr && organicPost?.offer_id) {
              offer_id = organicPost.offer_id;
              console.log(`[track-event] [fallback] offer_id via organic_posts → ${offer_id}`);
            } else {
              // 4) Final hostname-based fallback: infer by hostname against offers.site_host
              const host = hostnameFrom(event_data, body?.referrer || null);
              if (host) {
                const { data: offerByHost, error: hostErr } = await supabase
                  .from('offers')
                  .select('id, site_host')
                  .ilike('site_host', `%${host}%`)
                  .maybeSingle();

                if (!hostErr && offerByHost?.id) {
                  offer_id = offerByHost.id;
                  console.log(
                    `[track-event] [fallback] offer_id via offers.site_host (${offerByHost.site_host}) → ${offer_id}`
                  );
                } else {
                  console.warn('[track-event] offer_id not provided; all fallbacks failed', {
                    campaign_id,
                    host,
                    liveCampErr,
                    adErr,
                    liveErr,
                    organicErr,
                    hostErr,
                  });
                }
              } else {
                console.warn(
                  '[track-event] offer_id not provided; no hostname available and all fallbacks failed',
                  {
                    campaign_id,
                    liveCampErr,
                    adErr,
                    liveErr,
                    organicErr,
                  }
                );
              }
            }
          }
        }
      }
    }

    // 🔹 FINAL safety net:
    // If offer_id is still missing but campaign_id actually *is* an offers.id, treat it as such.
    if (!isBillableEvent && !offer_id && campaign_id) {
      try {
        const { data: offerFromCampaign, error: offerFromCampaignErr } = await supabase
          .from('offers')
          .select('id')
          .eq('id', campaign_id)
          .maybeSingle();

        if (!offerFromCampaignErr && offerFromCampaign?.id) {
          offer_id = offerFromCampaign.id;
          console.log(
            '[track-event] final fallback: campaign_id matched offers.id →',
            offer_id
          );
        } else if (offerFromCampaignErr) {
          console.warn('[track-event] final fallback offers.id lookup error', {
            campaign_id,
            offerFromCampaignErr,
          });
        }
      } catch (e) {
        console.warn('[track-event] final fallback threw', { campaign_id, e });
      }
    }

    // --- Paid Meta stats: if campaign_id still matches offer_id, remap to live_ads.id ---
    if (!isBillableEvent && offer_id && affiliate_id && campaign_id && campaign_id === offer_id) {
      try {
        const { data: paidLiveAd, error: paidLiveAdErr } = await supabase
          .from('live_ads')
          .select('id')
          .eq('offer_id', offer_id)
          .eq('affiliate_email', affiliate_id)
          .eq('campaign_type', 'paid_meta')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!paidLiveAdErr && paidLiveAd?.id) {
          console.log('[track-event] remapping campaign_id to live_ads.id for paid_meta flow', {
            old_campaign_id: campaign_id,
            new_campaign_id: paidLiveAd.id,
            offer_id,
            affiliate_id,
          });
          campaign_id = paidLiveAd.id;
        } else if (paidLiveAdErr) {
          console.warn('[track-event] paid_meta live_ads lookup error; keeping original campaign_id', {
            campaign_id,
            offer_id,
            affiliate_id,
            paidLiveAdErr,
          });
        }
      } catch (e) {
        console.warn('[track-event] paid_meta remap threw; keeping original campaign_id', {
          campaign_id,
          offer_id,
          affiliate_id,
          e,
        });
      }
    }

    // 🧩 Ensure campaign_id is a valid UUID before insert (remap if Meta numeric ID)
    if (!isBillableEvent && strictRuntimeCampaign) {
      campaign_id = strictRuntimeCampaign.campaignId;
      offer_id = offer_id || strictRuntimeCampaign.offerId;
    }

    if (!isBillableEvent && campaign_id && !isUuid(campaign_id)) {
      console.warn('[track-event] non-UUID campaign_id detected; attempting to remap from live_ads.meta_campaign_id →', campaign_id);
      try {
        const { data: matchAd, error: matchErr } = await supabase
          .from('live_ads')
          .select('id')
          .eq('meta_campaign_id', campaign_id)
          .maybeSingle();

        if (!matchErr && matchAd?.id) {
          console.log('[track-event] remapped Meta campaign ID to internal live_ads.id', {
            old_campaign_id: campaign_id,
            new_campaign_id: matchAd.id,
          });
          campaign_id = matchAd.id;
        } else if (matchErr) {
          console.warn('[track-event] remap lookup error', matchErr);
        } else {
          console.warn('[track-event] remap failed — no matching live_ads row for meta_campaign_id', campaign_id);
        }
      } catch (e) {
        console.error('[track-event] remap exception', e);
      }
    }

    // Insert into campaign_tracking_events
    const { data: insertedRows, error: insertErr } = await supabase
      .from('campaign_tracking_events')
      .insert([{
        event_type,
        affiliate_id,
        campaign_id,
        offer_id,
        event_data,
        amount,
        currency,
        ip_address:
          req.headers.get('x-forwarded-for') ||
          req.headers.get('X-Real-IP') ||
          null,
        user_agent: req.headers.get('user-agent') || null,
      }])
      .select('id, event_type, affiliate_id, campaign_id, offer_id, amount');

    if (insertErr || !insertedRows || !insertedRows[0]) {
      console.error('[track-event] insert error', insertErr);
      return jsonWithCors(req, { ok: false, error: 'db_insert_failed' }, { status: 500 });
    }

    const inserted = insertedRows[0];

    if (inserted.event_type === 'conversion') {
      try {
        const processUrl = new URL('/api/process-conversion', req.url);
        const processRes = await fetch(processUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: inserted.id }),
        });

        if (!processRes.ok) {
          const text = await processRes.text();
          console.warn('[track-event] process-conversion handoff failed', {
            event_id: inserted.id,
            status: processRes.status,
            body: text,
          });
        }
      } catch (handoffErr) {
        console.warn('[track-event] process-conversion handoff threw', {
          event_id: inserted.id,
          handoffErr,
        });
      }
    }

    return jsonWithCors(req, { ok: true, event_id: inserted.id });
  } catch (e) {
    console.error('[track-event] unhandled error', e);
    return jsonWithCors(
      req,
      { ok: false, error: 'unhandled' },
      { status: 500 }
    );
  }
}
