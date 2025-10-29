// app/api/track.gif/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only
);

// tiny transparent 1x1 GIF
const GIF = Uint8Array.from([
  71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,1,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59
]);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Required
    const event_type = url.searchParams.get('t') || 'page_view';

    // Attribution
    const affiliate_id = url.searchParams.get('aff');    // nm_aff
    const campaign_id  = url.searchParams.get('camp');   // nm_camp

    // Optional payload (URL-encoded JSON)
    const d = url.searchParams.get('d');
    let event_data: any = {};
    if (d) {
      try { event_data = JSON.parse(d); } catch {}
    }

    // Resolve offer_id from campaign if available (best-effort)
    let offer_id: string | null = null;
    if (campaign_id) {
      const { data: camp } = await supabase
        .from('live_campaigns')
        .select('offer_id')
        .eq('id', campaign_id)
        .maybeSingle();
      offer_id = camp?.offer_id || null;
    }

    await supabase.from('campaign_tracking_events').insert([{
      event_type,
      affiliate_id,
      campaign_id,
      offer_id,
      event_data,
      ip_address: req.headers.get('x-forwarded-for') || null,
      user_agent: req.headers.get('user-agent') || null,
    }]);

    return new NextResponse(GIF, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch {
    // even on error, send a 1x1 so the page never hangs
    return new NextResponse(GIF, {
      status: 200,
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' }
    });
  }
}