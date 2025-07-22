// app/api/meta/estimate-reach/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    access_token,
    ad_account_id,
    countries,
    age_min,
    age_max,
    genders,
    interests,
    optimization_goal,
    currency
  } = body;

  if (!access_token || !ad_account_id) {
    return NextResponse.json({ error: 'Missing access_token or ad_account_id' }, { status: 400 });
  }

  const targeting_spec = {
    geo_locations: {
      countries: countries || ['AU']
    },
    age_min: age_min || 18,
    age_max: age_max || 65,
    genders: genders || [1, 2],
    interests: interests || []
  };

  try {
    const fbRes = await fetch(`https://graph.facebook.com/v19.0/act_${ad_account_id}/reachestimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token,
        targeting_spec,
        optimization_goal: optimization_goal || 'REACH',
        currency: currency || 'AUD'
      })
    });

    const fbData = await fbRes.json();

    if (!fbRes.ok) {
      console.error('[Meta API Error]', fbData);
      return NextResponse.json({ error: 'Failed to fetch reach estimate', metaError: fbData }, { status: 500 });
    }

    return NextResponse.json({ success: true, estimate: fbData });
  } catch (err) {
    console.error('[Server Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}