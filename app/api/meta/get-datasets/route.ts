import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function j(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const business_email = String(body?.business_email || '').trim();
    const ad_account_id = String(body?.ad_account_id || '').trim();

    if (!business_email || !ad_account_id) {
      return j(
        {
          ok: false,
          error: 'Missing business_email or ad_account_id',
          received: { business_email, ad_account_id },
        },
        400
      );
    }

    // Service role is safest here because this is server-side and avoids any RLS surprises.
    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY'); // <- ensure this exists
    const supabase = createClient(supabaseUrl, serviceKey);

    // Pull the most recent token row for that ad account
    const { data: conn, error: connErr } = await supabase
      .from('meta_connections')
      .select('business_email, ad_account_id, access_token, created_at')
      .eq('business_email', business_email)
      .eq('ad_account_id', ad_account_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connErr) {
      return j(
        {
          ok: false,
          error: 'meta_connections lookup failed',
          details: connErr,
          debug: { business_email, ad_account_id },
        },
        500
      );
    }

    if (!conn?.access_token) {
      return j(
        {
          ok: false,
          error: 'No access_token found for that business_email + ad_account_id',
          debug: { business_email, ad_account_id, conn },
        },
        400
      );
    }

    const graphVersion = process.env.META_GRAPH_VERSION || 'v21.0';
    const endpoint =
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
        ad_account_id
      )}/adspixels?fields=id,name&limit=500`;

    // NOTE: We pass token via header-unsafe query string because Meta supports it cleanly
    const url = `${endpoint}&access_token=${encodeURIComponent(conn.access_token)}`;

    const r = await fetch(url, { method: 'GET' });
    const raw = await r.text();

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }

    // Meta error passthrough
    if (!r.ok || parsed?.error) {
      return j(
        {
          ok: false,
          error: 'Meta returned error for adspixels',
          meta_status: r.status,
          meta: parsed,
          debug: {
            graphVersion,
            ad_account_id,
            endpoint,
            took_ms: Date.now() - startedAt,
          },
        },
        200 // keep 200 so your UI always prints debug; you can change to 400 if you want
      );
    }

    const pixels = Array.isArray(parsed?.data)
      ? parsed.data.map((p: any) => ({
          id: String(p?.id || ''),
          name: String(p?.name || ''),
          ad_account_id,
        }))
      : [];

    return j({
      ok: true,
      pixels,
      debug: {
        graphVersion,
        ad_account_id,
        count: pixels.length,
        endpoint,
        took_ms: Date.now() - startedAt,
      },
      meta_raw: parsed, // keep this while debugging; remove later
    });
  } catch (e: any) {
    return j(
      {
        ok: false,
        error: 'Server crashed in /api/meta/get-datasets',
        message: String(e?.message || e),
      },
      500
    );
  }
}