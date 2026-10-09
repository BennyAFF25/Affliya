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

    if (Array.isArray(interests) && interests.length > 0) {
      const selectedIds = interests.map((item: { id?: unknown }) => String(item?.id || "").trim());
      if (selectedIds.some((id: string) => !/^\\d{2,30}$/.test(id))) {
        return NextResponse.json({ error: "Choose valid Meta interests from the suggestions." }, { status: 409 });
      }
      targeting.flexible_spec = [{ interests: selectedIds.map((id: string) => ({ id })) }];
    }

    // Merge placement spec if provided (publisher_platforms, *_positions, device_platforms, etc.)
    if (placementSpec && typeof placementSpec === 'object') {
      Object.assign(targeting, placementSpec);
    }

    // Meta removed daily-active-user estimates in v26; request truthful
    // potential audience bounds rather than showing fake daily/monthly values.
    const params = new URLSearchParams({ targeting_spec: JSON.stringify(targeting) });
    const url = `https://graph.facebook.com/v26.0/act_${numeric}/reachestimate?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("[meta/estimate-reach] Meta rejected reach estimate", {
        status: response.status, code: json?.error?.code, subcode: json?.error?.error_subcode,
      });
      return NextResponse.json({
        error: json?.error?.message || "Meta could not estimate the audience.",
      }, { status: 502 });
    }
    const data = Array.isArray(json?.data) ? json.data[0] : json?.data || json;
    const lower = Number(data?.users_lower_bound);
    const upper = Number(data?.users_upper_bound);
    return NextResponse.json({
      data: [{
        users_lower_bound: Number.isFinite(lower) && lower >= 0 ? lower : null,
        users_upper_bound: Number.isFinite(upper) && upper >= 0 ? upper : null,
      }],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error('[estimate-reach server error]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}