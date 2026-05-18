// app/api/track.gif/route.ts
import { NextRequest, NextResponse } from 'next/server';

// tiny transparent 1x1 GIF
const GIF = Uint8Array.from([
  71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,1,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59,
]);

function gifResponse() {
  return new NextResponse(GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Nettmark-Legacy-Track-Gif': 'proxied-to-track-event',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const event_type = url.searchParams.get('t') || 'page_view';
    const affiliate_id = url.searchParams.get('aff');
    const campaign_id = url.searchParams.get('camp');

    const d = url.searchParams.get('d');
    let event_data: Record<string, unknown> = {};

    if (d) {
      try {
        const parsed = JSON.parse(d);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          event_data = parsed as Record<string, unknown>;
        }
      } catch {
        event_data = {};
      }
    }

    const payload = {
      event_type,
      affiliate_id,
      campaign_id,
      event_data,
      legacy_source: 'track.gif',
    };

    try {
      const trackEventUrl = new URL('/api/track-event', req.url);
      const res = await fetch(trackEventUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn('[track.gif] legacy proxy to /api/track-event failed', {
          status: res.status,
          event_type,
          affiliate_id,
          campaign_id,
          body,
        });
      }
    } catch (handoffErr) {
      console.warn('[track.gif] legacy proxy to /api/track-event threw', {
        event_type,
        affiliate_id,
        campaign_id,
        handoffErr,
      });
    }

    return gifResponse();
  } catch {
    return gifResponse();
  }
}
