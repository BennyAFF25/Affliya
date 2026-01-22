// app/api/stripe/transfer-ad-spend/route.ts
import { NextResponse } from 'next/server';

/**
 * DEPRECATED (Jan 2026)
 * --------------------
 * This route used to directly deduct wallet + update spend + create Stripe transfers.
 * That path can cause double-charges and unit mismatches now that Nettmark uses:
 *
 *   - Meta spend sync → live_ads.spend
 *   - Settle-on-pause billing → /api/ad-spend/settle (guarded by spend_transferred)
 *
 * ✅ Use: POST /api/ad-spend/settle { liveAdId }
 *
 * This route is intentionally disabled to prevent accidental future usage.
 */

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json().catch(() => null);
  } catch {
    // ignore
  }

  console.warn('[DEPRECATED] /api/stripe/transfer-ad-spend was called', {
    body,
    hint: 'Use POST /api/ad-spend/settle { liveAdId }',
  });

  return NextResponse.json(
    {
      success: false,
      error: 'DEPRECATED_ROUTE',
      message:
        'This route is deprecated and disabled to prevent double-charging. Use POST /api/ad-spend/settle with { liveAdId }.',
      replacement: '/api/ad-spend/settle',
      example: { liveAdId: body?.liveAdId || body?.live_ad_id || body?.live_ad_id || '<LIVE_AD_ID>' },
      received: body,
    },
    { status: 410 }
  );
}

// (Optional) If anything tries to GET it, also kill it loudly.
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'DEPRECATED_ROUTE',
      message:
        'This route is deprecated and disabled. Use POST /api/ad-spend/settle with { liveAdId }.',
      replacement: '/api/ad-spend/settle',
    },
    { status: 410 }
  );
}