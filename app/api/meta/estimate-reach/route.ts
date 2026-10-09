import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      offer_id,
      countries = [],
      age_min = 18,
      age_max = 65,
      genders = [],
      interests = [],
      optimization_goal = 'REACH',
      placementSpec,
    } = body || {};

    // Do not accept Meta tokens/account IDs from the browser. They are
    // business-owned credentials and must never be revealed to affiliates.
    const userClient = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user?.email) {
      return NextResponse.json({ error: 'Sign in to estimate campaign reach.' }, { status: 401 });
    }
    if (!offer_id) {
      return NextResponse.json({ error: 'An offer is required for estimates.' }, { status: 400 });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Estimator configuration unavailable.' }, { status: 500 });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: offer, error: offerErr } = await admin
      .from('offers')
      .select('business_email,meta_page_id,meta_ad_account_id')
      .eq('id', offer_id)
      .maybeSingle();
    if (offerErr || !offer?.business_email || !offer.meta_page_id || !offer.meta_ad_account_id) {
      return NextResponse.json({ error: 'This offer has not connected a complete Meta account.' }, { status: 409 });
    }
    const { data: mcRows, error: mcErr } = await admin
      .from('meta_connections')
      .select('access_token,ad_account_id,page_id,created_at')
      .eq('business_email', offer.business_email)
      .eq('page_id', offer.meta_page_id)
      .order('created_at', { ascending: false });
    if (mcErr) {
      console.error('[estimate-reach] Meta connection lookup failed', mcErr);
      return NextResponse.json({ error: 'Cannot resolve this offer\'s connected Meta account.' }, { status: 409 });
    }
    const expectedAccount = String(offer.meta_ad_account_id).replace(/^act_/, '');
    const chosen = (mcRows || []).find(
      (r) => String(r.ad_account_id || '').replace(/^act_/, '') === expectedAccount && r.access_token,
    );
    const token = String(chosen?.access_token || '').trim();
    const numeric = expectedAccount;
    if (!token) {
      return NextResponse.json({ error: 'Reconnect this offer\'s Meta account for estimates.' }, { status: 409 });
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
      optimization_goal,
      targeting_spec: JSON.stringify(targeting),
    });

    const url = `https://graph.facebook.com/v19.0/act_${numeric}/delivery_estimate?${params.toString()}`;
    const r = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
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