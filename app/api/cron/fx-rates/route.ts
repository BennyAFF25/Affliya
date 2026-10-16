import { timingSafeEqual } from 'node:crypto';
import { fxServiceClient, getAudRate } from '../../../../utils/fx/rates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export function createFxRatesHandler(refresh = (currency: string) => getAudRate(currency, { client: fxServiceClient(), refresh: true })) {
  return async (req: Request) => {
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
    const actual = req.headers.get('authorization') || '';
    if (!expected || Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const results = await Promise.allSettled(['USD', 'GBP', 'CAD'].map(refresh));
    const ok = results.every(result => result.status === 'fulfilled');
    return Response.json({ ok, currencies: results.map((result, i) => ({ currency: ['USD', 'GBP', 'CAD'][i],
      ...(result.status === 'fulfilled' ? { rate: result.value } : { error: 'FX refresh failed' }) })) },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  };
}
export const GET = createFxRatesHandler();
