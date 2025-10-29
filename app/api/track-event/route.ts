// app/api/track-event/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only
);

export async function POST(req: NextRequest) {
  try {
    // Accept text/plain (simple request) and parse
    const raw = await req.text();
    let body: any = {};
    try { body = JSON.parse(raw || '{}'); } catch {}

    const { event_type, affiliate_id, campaign_id, event_data = {} } = body;
    if (!event_type) {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 });
    }

    // Resolve offer_id from campaign if present
    let offer_id: string | null = null;
    if (campaign_id) {
      const { data: camp } = await supabase
        .from('live_campaigns')
        .select('offer_id')
        .eq('id', campaign_id)
        .maybeSingle();
      offer_id = camp?.offer_id || null;
    }

    const { error } = await supabase.from('campaign_tracking_events').insert([{
      event_type,
      affiliate_id,
      campaign_id,
      offer_id,
      event_data,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('X-Real-IP') || null,
      user_agent: req.headers.get('user-agent') || null
    }]);

    if (error) {
      console.error('[track-event] insert error', error);
      return NextResponse.json({ error: 'db_insert_failed' }, { status: 500 });
    }

    // Opaque responses are fine; still return JSON for normal fetches
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('[track-event] error', e);
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
}

// (OPTIONAL) If you also want the endpoint to be callable with application/json from your own origin,
// you can add an OPTIONS handler with CORS headers later—but not required for the simple request path.