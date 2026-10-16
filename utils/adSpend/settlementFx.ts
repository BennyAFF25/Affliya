import { getAudRate, type AudRate } from '../fx/rates';
import { guardPaidCurrency } from '../currency/paidCurrencyGuard';

// Decimal arithmetic avoids binary floating point ties (e.g. 1.005).
function power10(exponent: number) {
  let value = BigInt(1);
  for (let i = 0; i < exponent; i++) value *= BigInt(10);
  return value;
}
function decimal(value: number): [bigint, bigint] {
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  const places = (mantissa.split('.')[1]?.length || 0) - Number(exponent);
  return [BigInt(mantissa.replace('.', '')) * power10(Math.max(0, -places)), power10(Math.max(0, places))];
}
export function settlementAud(original: number, rate: number) {
  if (!Number.isFinite(original) || original < 0 || !Number.isFinite(rate) || rate <= 0) throw new Error('Invalid settlement conversion');
  const [a, b] = decimal(original), [c, d] = decimal(rate);
  return Number((a * c * BigInt(200) + b * d) / (BigInt(2) * b * d)) / 100;
}
export function fundedOriginal(original: number, rate: number, funding: number) {
  let low = 0, high = Math.round(original * 100);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (settlementAud(mid / 100, rate) <= funding) low = mid;
    else high = mid - 1;
  }
  return low / 100;
}
export async function settlementQuote(supabase: Parameters<typeof guardPaidCurrency>[0]['supabase'], liveAdId: string) {
  const currency = await guardPaidCurrency({ supabase, liveAdId, settlementOnly: true });
  try {
    if (!currency.allowed) throw new Error(currency.reason || 'unknown_spend_currency');
    const fx: AudRate | null = currency.campaignCurrency === 'AUD' ? null
      : await getAudRate(currency.campaignCurrency, { client: supabase });
    return { currency, fx };
  } catch (error) {
    console.warn('[ad-spend] settlement deferred', { event: 'FX_SETTLEMENT_DEFERRED', liveAdId,
      originalCurrency: currency.campaignCurrency || null, reason: error instanceof Error ? error.message : 'FX_UNAVAILABLE' });
    return null;
  }
}
