import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '../../../../utils/supabase/createServerClient';
import { createPixelEventsHandler, createPixelLimiter, pixelOptions } from '../../../../lib/shopify/pixel-events';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limit = createPixelLimiter(async (name, args) => await createServerSupabaseClient().rpc(name, args).abortSignal(AbortSignal.timeout(3000)), () => process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY);
export const OPTIONS = pixelOptions;
export const POST = createPixelEventsHandler({
  admin: createServerSupabaseClient,
  limit,
  async process(eventId) {
    const { POST: processConversion } = await import('../../process-conversion/route');
    const response = await processConversion(new NextRequest('http://internal/api/process-conversion', { method: 'POST', body: JSON.stringify({ event_id: eventId }), headers: { 'Content-Type': 'application/json' } }));
    if (!response.ok) throw new Error('processing_pending');
  },
  log(shop, outcome) { console.info('[shopify_pixel]', { shop, outcome }); },
});
