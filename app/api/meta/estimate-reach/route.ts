import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      access_token,
      ad_account_id,
      offer_id,
      countries = [],
      age_min = 18,
      age_max = 65,
      genders = [],
      interests = [],
      optimization_goal = 'REACH',
      placementSpec,
    } = body || {};

    let token = String(access_token || '').trim();
    let numeric = String(ad_account_id || '').replace(/^act_/, '').trim();
    const diagnostics: Record<string, unknown> = {
      usedServerFallback: false,
      clientProvidedToken: Boolean(token),
      clientProvidedAdAccount: Boolean(numeric),
      resolvedAdAccount: numeric ? `act_${numeric}` : null,
      matchedMetaConnectionByPage: false,
      placementRetry: false,
    };

    // Fallback: resolve Meta credentials by offer_id server-side (avoids client RLS constraints)
    if ((!token || !numeric) && offer_id) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Server missing Supabase admin env for estimator fallback' }, { status: 500 });
      }

      const admin = createClient(supabaseUrl, serviceKey);

      diagnostics.usedServerFallback = true;

      const { data: offer, error: offerErr } = await admin
        .from('offers')
        .select('business_email, meta_page_id, meta_ad_account_id')
        .eq('id', offer_id)
        .single();

      if (offerErr || !offer?.business_email) {
        return NextResponse.json(
          {
            error: 'Could not resolve offer/business for estimator',
            diagnostics: { ...diagnostics, offerLookupError: offerErr?.message || null },
          },
          { status: 400 },
        );
      }

      diagnostics.offerBusinessEmail = offer.business_email;
      diagnostics.offerMetaPageId = offer.meta_page_id || null;
      diagnostics.offerMetaAdAccountId = offer.meta_ad_account_id || null;

      const { data: mcRows, error: mcErr } = await admin
        .from('meta_connections')
        .select('access_token, ad_account_id, page_id, updated_at')
        .eq('business_email', offer.business_email)
        .order('updated_at', { ascending: false });

      if (mcErr) {
        return NextResponse.json(
          {
            error: 'Could not resolve meta connection for offer',
            diagnostics: { ...diagnostics, metaConnectionError: mcErr.message },
          },
          { status: 400 },
        );
      }

      const rows = (mcRows || []) as Array<{ access_token?: string | null; ad_account_id?: string | null; page_id?: string | null }>;
      const valid = rows.filter((r) => !!r.access_token && !!r.ad_account_id);
      diagnostics.metaConnectionCount = rows.length;
      diagnostics.validMetaConnectionCount = valid.length;

      const offerPageId = String(offer.meta_page_id || '').trim();
      const offerAdAccountId = String(offer.meta_ad_account_id || '').replace(/^act_/, '').trim();
      const matchedByPage = offerPageId ? valid.find((r) => String(r.page_id || '').trim() === offerPageId) : null;
      const matchedByAdAccount = offerAdAccountId ? valid.find((r) => String(r.ad_account_id || '').replace(/^act_/, '').trim() === offerAdAccountId) : null;
      const chosen = matchedByPage || matchedByAdAccount || valid[0] || null;

      diagnostics.matchedMetaConnectionByPage = Boolean(matchedByPage);
      diagnostics.matchedMetaConnectionByAdAccount = Boolean(!matchedByPage && matchedByAdAccount);
      diagnostics.selectedMetaConnectionPageId = chosen?.page_id || null;
      diagnostics.selectedMetaConnectionAdAccountId = chosen?.ad_account_id || null;

      token = String(chosen?.access_token || '').trim();
      numeric = String(chosen?.ad_account_id || '').replace(/^act_/, '').trim();
      diagnostics.resolvedAdAccount = numeric ? `act_${numeric}` : null;
    }

    // normalize id; add act_ exactly once
    if (!token || !numeric) {
      return NextResponse.json(
        { error: 'Missing token or ad_account_id (and fallback lookup failed)', diagnostics },
        { status: 400 },
      );
    }

    type TargetingSpec = Record<string, unknown>;
    type InterestInput = { id?: string | number; name?: string };

    // Build targeting_spec
    const targeting: TargetingSpec = {
      geo_locations: { countries },
      age_min,
      age_max,
    };

    if (Array.isArray(genders) && genders.length > 0) {
      targeting.genders = genders.map((g: unknown) => Number(g));
    }

    let interestsIgnored = false;
    if (Array.isArray(interests) && interests.length > 0) {
      // Meta requires numeric interest IDs. If non-numeric provided, ignore for estimate (avoid zeroed results).
      const numericId = (v: string) => /^\d+$/.test(v);
      const mapped = (interests as unknown[])
        .map((i): { id: string } | null => {
          if (!i || typeof i !== 'object' || !('id' in i)) return null;
          const id = String((i as InterestInput).id || '');
          return numericId(id) ? { id } : null;
        })
        .filter((entry): entry is { id: string } => Boolean(entry));
      if (mapped.length > 0) {
        targeting.flexible_spec = [{ interests: mapped }];
      } else {
        interestsIgnored = true;
      }
    }

    // Merge placement spec if provided (publisher_platforms, *_positions, device_platforms, etc.)
    if (placementSpec && typeof placementSpec === 'object') {
      Object.assign(targeting, placementSpec as TargetingSpec);
    }

    async function requestEstimate(targetingSpec: TargetingSpec) {
      const params = new URLSearchParams({
        access_token: token,
        optimization_goal,
        targeting_spec: JSON.stringify(targetingSpec),
      });

      const url = `https://graph.facebook.com/v19.0/act_${numeric}/delivery_estimate?${params.toString()}`;
      const response = await fetch(url, { method: 'GET' });
      const json = await response.json();
      return { response, json };
    }

    let { response: r, json } = await requestEstimate(targeting);

    if (!r.ok) {
      const apiMessage = String(json?.error?.message || json?.error || '').toLowerCase();
      const looksLikePlacementIssue =
        apiMessage.includes('publisher_platforms') ||
        apiMessage.includes('facebook_positions') ||
        apiMessage.includes('instagram_positions') ||
        apiMessage.includes('placement') ||
        apiMessage.includes('targeting spec');

      if (looksLikePlacementIssue && placementSpec) {
        console.warn('[estimate-reach] retrying without placement spec', json);
        diagnostics.placementRetry = true;
        diagnostics.placementRetryReason = json?.error?.message || json?.error || null;
        const targetingWithoutPlacements = { ...targeting };
        delete targetingWithoutPlacements.publisher_platforms;
        delete targetingWithoutPlacements.facebook_positions;
        delete targetingWithoutPlacements.instagram_positions;
        delete targetingWithoutPlacements.device_platforms;

        const retried = await requestEstimate(targetingWithoutPlacements);
        r = retried.response;
        json = retried.json;
      }
    }

    if (!r.ok) {
      console.error('[Meta API Error]', { json, diagnostics });
      return NextResponse.json(
        {
          error: json?.error?.message || json?.error || 'Meta reach estimate failed',
          metaError: json?.error || json,
          diagnostics,
        },
        { status: r.status },
      );
    }

    const first = Array.isArray(json?.data) ? json.data[0] : null;
    const shaped = first
      ? [{
          estimate_ready: first?.estimate_ready ?? true,
          // Some API versions return numeric, others an object with bounds
          estimate_dau: first?.estimate_dau ?? first?.users_dau ?? null,
          estimate_mau: first?.estimate_mau ?? first?.users_mau ?? null,
          estimate_dau_lower: first?.estimate_dau_lower ?? first?.estimate_dau?.lower_bound ?? null,
          estimate_dau_upper: first?.estimate_dau_upper ?? first?.estimate_dau?.upper_bound ?? null,
          estimate_mau_lower: first?.estimate_mau_lower ?? first?.estimate_mau?.lower_bound ?? null,
          estimate_mau_upper: first?.estimate_mau_upper ?? first?.estimate_mau?.upper_bound ?? null,
        }]
      : [];

    return NextResponse.json({
      data: shaped,
      meta: {
        interests_ignored: typeof interestsIgnored === 'boolean' ? interestsIgnored : false,
        diagnostics: {
          ...diagnostics,
          metaRowsReturned: Array.isArray(json?.data) ? json.data.length : 0,
          estimateReady: first?.estimate_ready ?? null,
        },
      },
    });
  } catch (e) {
    console.error('[estimate-reach server error]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}