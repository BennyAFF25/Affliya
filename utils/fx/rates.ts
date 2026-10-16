/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';

export type AudRate = { rate: number; source: string; rate_date: string };
const bounds: Record<string, [number, number]> = { USD: [0.5, 3], GBP: [0.8, 4], CAD: [0.4, 2.5] };
export function fxBufferBps() {
  const value = Number(process.env.FX_BUFFER_BPS ?? 400);
  if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error('Invalid FX_BUFFER_BPS');
  return value;
}
export function fxServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service environment');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getAudRate(currency: string, options: {
  client?: any; fetch?: typeof fetch; now?: Date; refresh?: boolean;
} = {}): Promise<AudRate> {
  const base = currency.trim().toUpperCase();
  const now = options.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  if (base === 'AUD') return { rate: 1, source: 'identity', rate_date: today };
  if (!bounds[base]) throw new Error(`Unsupported FX currency: ${base}`);
  const maxHours = Number(process.env.FX_MAX_STALENESS_HOURS ?? 72);
  if (!Number.isFinite(maxHours) || maxHours <= 0) throw new Error('Invalid FX_MAX_STALENESS_HOURS');
  const client = options.client ?? fxServiceClient();
  const sane = (row: any): row is AudRate => {
    const date = String(row?.rate_date ?? '');
    const time = Date.parse(date + 'T00:00:00Z');
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === date && time <= now.getTime() &&
      ['frankfurter', 'open.er-api'].includes(row?.source) &&
      Number(row?.rate) >= bounds[base][0] && Number(row?.rate) <= bounds[base][1];
  };
  const fresh = (row: AudRate) => now.getTime() - Date.parse(row.rate_date + 'T00:00:00Z') <= maxHours * 3600000;
  const { data, error } = await client.from('fx_rates').select('rate,source,rate_date')
    .eq('base', base).eq('quote', 'AUD').lte('rate_date', today)
    .order('rate_date', { ascending: false }).order('fetched_at', { ascending: false }).limit(100);
  if (error) throw new Error('FX cache read failed');
  const last = (data ?? []).find(sane) as AudRate | undefined;
  const normalize = (row: AudRate) => ({ ...row, rate: Number(row.rate) });
  if (!options.refresh && last?.rate_date === today && fresh(last)) return normalize(last);
  const fetcher = options.fetch ?? fetch;
  for (const source of ['frankfurter', 'open.er-api']) {
    let row: AudRate;
    try {
      let url = source === 'frankfurter'
        ? `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=AUD`
        : `https://open.er-api.com/v6/latest/${base}`;
      const signal = AbortSignal.timeout(10000);
      let response: Response;
      for (let redirects = 0; ; redirects++) {
        response = await fetcher(url, { redirect: 'manual', cache: 'no-store', signal });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        if (!location || redirects >= 3) throw new Error('Invalid FX redirect');
        const next = new URL(location, url);
        if (next.protocol !== 'https:' || next.username || next.password || next.port ||
          !['api.frankfurter.dev', 'api.frankfurter.app', 'open.er-api.com'].includes(next.hostname)) {
          throw new Error('Unsafe FX redirect');
        }
        url = next.href;
      }
      if (!response.ok) throw new Error('FX provider unavailable');
      const body = await response.json();
      if (source === 'frankfurter' ? body.base !== base : body.result !== 'success' || body.base_code !== base) throw new Error('Invalid FX base');
      row = { rate: body.rates?.AUD, source, rate_date: source === 'frankfurter'
        ? body.date : new Date(body.time_last_update_unix * 1000).toISOString().slice(0, 10) };
      if (!sane(row) || !fresh(row)) throw new Error('Invalid or stale FX quote');
      if (source === 'open.er-api' && (!last || Math.abs(Number(row.rate) / Number(last.rate) - 1) > 0.05)) throw new Error('Fallback FX deviates from baseline');
    } catch { continue; }
    const saved = await client.from('fx_rates').upsert({ base, quote: 'AUD', ...row,
      fetched_at: now.toISOString() }, { onConflict: 'base,quote,rate_date,source' });
    if (saved.error) throw new Error('FX cache write failed');
    return normalize(row);
  }
  if (last && fresh(last)) return normalize(last);
  throw new Error(`No usable ${base}/AUD FX rate within FX_MAX_STALENESS_HOURS (${maxHours}h)`);
}
