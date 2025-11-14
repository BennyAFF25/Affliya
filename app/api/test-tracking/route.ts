import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const offer_id = body?.offer_id as string | undefined;
    const business_email = body?.business_email as string | undefined;

    if (!offer_id || !business_email) {
      return NextResponse.json(
        { error: 'offer_id and business_email required' },
        { status: 400 }
      );
    }

    // (Optional) sanity-check the offer exists
    const { data: offer, error: offerErr } = await supabase
      .from('offers')
      .select('id, business_email')
      .eq('id', offer_id)
      .single();

    if (offerErr || !offer) {
      return NextResponse.json(
        { error: 'offer_not_found' },
        { status: 404 }
      );
    }

    const { error: insertErr } = await supabase
      .from('campaign_tracking_events')
      .insert({
        event_type: 'test_pixel',
        affiliate_id: business_email, // using biz email here just so something is set
        campaign_id: null,
        offer_id,
        event_data: {
          source: 'setup-tracking-test-button',
          business_email,
        },
      });

    if (insertErr) {
      console.error('[test-tracking] insert error', insertErr);
      return NextResponse.json(
        { error: 'insert_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[test-tracking] unexpected error', err);
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500 }
    );
  }
}