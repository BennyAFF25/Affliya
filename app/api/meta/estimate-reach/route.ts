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

    // Fallback: resolve Meta credentials by offer_id server-side (avoids client RLS constraints)
    if ((!token || !numeric) && offer_id) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Server missing Supabase admin env for estimator fallback' }, { status: 500 });
      }

      const admin = createClient(supabaseUrl, serviceKey);

      const { data: offer, error: offerErr } = await admin
        .from('offers')
        .select('business_email, meta_page_id')
        .eq('id', offer_id)
        .single();

      if (offerErr || !offer?.business_email) {
        return NextResponse.json({ error: 'Could not resolve offer/business for estimator' }, { status: 400 });
      }

      const { data: mcRows, error: mcErr } = await admin
        .from('meta_connections')
        .select('access_token, ad_account_id, page_id, updated_at')
        .eq('business_email', offer.business_email)
        .order('updated_at', { ascending: false });

      if (mcErr) {
        return NextResponse.json({ error: 'Could not resolve meta connection for offer' }, { status: 400 });
      }

      const rows = (mcRows || []) as Array<{ access_token?: string | null; ad_account_id?: string | null; page_id?: string | null }>;
      const valid = rows.filter((r) => !!r.access_token && !!r.ad_account_id);
      const offerPageId = String(offer.meta_page_id || '').trim();
      const matchedByPage = offerPageId ? valid.find((r) => String(r.page_id || '').trim() === offerPageId) : null;
      const chosen = matchedByPage || valid[0] || null;

      token = String(chosen?.access_token || '').trim();
      numeric = String(chosen?.ad_account_id || '').replace(/^act_/, '').trim();
    }

    // normalize id; add act_ exactly once
    if (!token || !numeric) {
      return NextResponse.json({ error: 'Missing token or ad_account_id (and fallback lookup failed)' }, { status: 400 });
    }

    // Build targeting_spec
    const targeting: any = {
      geo_locations: { countries },
      age_min,
      age_max,
    };

    if (Array.isArray(genders) && genders.length > 0) {
      targeting.genders = genders.map((g: any) => Number(g));
    }

    let interestsIgnored = false;
    if (Array.isArray(interests) && interests.length > 0) {
      // Meta requires numeric interest IDs. If non-numeric provided, ignore for estimate (avoid zeroed results).
      const numericId = (v: any) => typeof v === 'string' && /^\d+$/.test(v);
      const mapped = interests
        .map((i: any) => (typeof i === 'object' && i?.id && numericId(String(i.id)) ? { id: String(i.id) } : null))
        .filter(Boolean);
      if (mapped.length > 0) {
        targeting.flexible_spec = [{ interests: mapped }];
      } else {
        interestsIgnored = true;
      }
    }

    // Merge placement spec if provided (publisher_platforms, *_positions, device_platforms, etc.)
    if (placementSpec && typeof placementSpec === 'object') {
      Object.assign(targeting, placementSpec);
    }

    // Note: `currency` is not a valid param for delivery_estimate; omit to avoid (#100)
    const params = new URLSearchParams({
      access_token: token,
      optimization_goal,
      targeting_spec: JSON.stringify(targeting),
    });

    const url = `https://graph.facebook.com/v19.0/act_${numeric}/delivery_estimate?${params.toString()}`;
    const r = await fetch(url, { method: 'GET' }); // <-- GET, not POST
    const json = await r.json();

    if (!r.ok) {
      console.error('[Meta API Error]', json);
      return NextResponse.json(json, { status: r.status });
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

    return NextResponse.json({ data: shaped, meta: { interests_ignored: typeof interestsIgnored === 'boolean' ? interestsIgnored : false } });
  } catch (e) {
    console.error('[estimate-reach server error]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}