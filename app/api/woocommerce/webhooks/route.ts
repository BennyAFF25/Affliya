import { NextRequest } from 'next/server';
import { createWebhookHandler } from '../../../../lib/woocommerce/webhooks';
import { createServerSupabaseClient } from '../../../../utils/supabase/createServerClient';
import { POST as processConversion } from '../../process-conversion/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = createWebhookHandler({
  admin: createServerSupabaseClient,
  process: async eventId => {
    const result = await processConversion(new NextRequest('https://nettmark.internal/api/process-conversion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: eventId }) }));
    if (result.status >= 500) throw new Error('processing_failed');
  },
  log: (store, outcome) => console.info('[woocommerce]', { store, outcome }),
});
