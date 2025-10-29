import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      event_type,            // 'page_view' | 'add_to_cart' | 'conversion' | 'click'
      affiliate_id,          // string | null
      campaign_id,           // string | null
      event_data = {}        // object
    } = body || {};

    if (!event_type) {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 });
    }

    // Optional: resolve offer_id from campaign_id if you want to store it
    let offer_id: string | null = null;
    if (campaign_id) {
      const { data: camp, error: campErr } = await supabase
        .from('live_campaigns')
        .select('offer_id')
        .eq('id', campaign_id)
        .single();
      if (!campErr && camp?.offer_id) offer_id = camp.offer_id;
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[track-event] error', e);
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
}