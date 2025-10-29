import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple dynamic CORS reflection
function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: cors(origin) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  try {
    const body = await req.json();
    const { event_type, affiliate_id, campaign_id, event_data = {} } = body;

    if (!event_type)
      return new NextResponse(
        JSON.stringify({ error: 'Missing event_type' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors(origin) } }
      );

    let offer_id: string | null = null;
    if (campaign_id) {
      const { data } = await supabase
        .from('live_campaigns')
        .select('offer_id')
        .eq('id', campaign_id)
        .maybeSingle();
      offer_id = data?.offer_id || null;
    }

    const { error } = await supabase.from('campaign_tracking_events').insert([
      {
        event_type,
        affiliate_id,
        campaign_id,
        offer_id,
        event_data,
        ip_address: req.headers.get('x-forwarded-for') || null,
        user_agent: req.headers.get('user-agent') || null,
      },
    ]);

    if (error) throw error;

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors(origin) },
    });
  } catch (err) {
    console.error('❌ Track event failed', err);
    return new NextResponse(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) } }
    );
  }
}