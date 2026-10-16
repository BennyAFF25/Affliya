/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolveOfferCurrency } from '../currency/proposalCurrency';
import { getAudRate, fxBufferBps } from '../fx/rates';

// Decimal multiplication avoids binary floating-point cent-boundary over-reservation.
export function audHoldAmount(amount: number, rate: number, buffer: number) {
  const fraction = (value: number) => {
    const [mantissa, exponent = '0'] = String(value).split('e');
    const decimals = (mantissa.split('.')[1] || '').length - Number(exponent);
    return decimals >= 0 ? [BigInt(mantissa.replace('.', '')), BigInt('1' + '0'.repeat(decimals))]
      : [BigInt(mantissa.replace('.', '')) * BigInt('1' + '0'.repeat(-decimals)), BigInt(1)];
  };
  const [a, ad] = fraction(amount);
  const [r, rd] = fraction(rate);
  const numerator = a * r * BigInt(10000 + buffer) * BigInt(100);
  const denominator = ad * rd * BigInt(10000);
  const cents = (numerator + denominator - BigInt(1)) / denominator;
  if (cents <= BigInt(0) || cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid FX hold amount');
  return Number(cents) / 100;
}

export const FUNDING_ERROR = 'AFFILIATE_CAMPAIGN_FUNDING_REQUIRED';

export async function getLaunchWalletAvailable(client: any, email: string, referenceId?: string) {
  const { data, error } = await client.rpc('get_launch_wallet_available', {
    p_affiliate_email: email,
    p_exclude_reference_id: referenceId || null,
  });
  if (error) throw new Error(`Failed to load available campaign funding: ${error.message}`);
  const amount = Number(data);
  if (data == null || !Number.isFinite(amount) || amount < 0) throw new Error('Invalid available campaign funding');
  return amount;
}

export async function reserveLaunchHold(client: any, email: string, amount: number, referenceId: string, currency?: string) {
  const proposal = await client.from('ad_ideas').select('offer_id,currency').eq('id', referenceId).maybeSingle();
  if (proposal.error || !proposal.data?.offer_id) throw new Error('Unable to verify proposal currency.');
  const offer = await client.from('offers').select('currency').eq('id', proposal.data.offer_id).maybeSingle();
  if (offer.error || !offer.data) throw new Error('Unable to verify offer currency.');
  const resolved = resolveOfferCurrency(proposal.data.currency, offer.data.currency);
  if (!resolved.allowed) throw new Error(resolved.message!);
  const supplied = resolveOfferCurrency(currency, offer.data.currency);
  if (!supplied.allowed) throw new Error(supplied.message!);
  const base = resolved.campaignCurrency;
  if (base !== 'AUD') {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid launch hold amount');
    const quote = await getAudRate(base, { client });
    const buffer = fxBufferBps();
    const audAmount = audHoldAmount(amount, quote.rate, buffer);
    const { data, error } = await client.rpc('reserve_launch_hold_fx', {
      p_affiliate_email: email, p_amount: audAmount, p_reference_id: referenceId,
      p_original_amount: amount, p_original_currency: base, p_fx_rate: quote.rate,
      p_fx_source: quote.source, p_fx_rate_date: quote.rate_date, p_fx_buffer_bps: buffer,
    });
    if (error || !data) throw new Error(error?.message || 'Unable to reserve FX campaign funding.');
    return data as string;
  }
  // AUD retains the original RPC and nullable FX metadata.
  const { data, error } = await client.rpc('reserve_launch_hold', {
    p_affiliate_email: email, p_currency: 'AUD', p_amount: amount,
    p_reference_type: 'ad_ideas', p_reference_id: referenceId,
  });
  if (error) throw new Error(error.message || 'Unable to reserve campaign funding.');
  if (!data) throw new Error('Unable to reserve campaign funding.');
  return data as string;
}

export async function releaseLaunchHold(client: any, referenceId: string) {
  try {
    const { error } = await client.rpc('release_launch_hold', {
      p_reference_type: 'ad_ideas', p_reference_id: referenceId,
    });
    if (error) throw error;
  } catch (error) {
    // Retaining a hold fails closed; it must never mask the original launch error.
    console.error('[launch-hold] release failed', { referenceId, error });
  }
}
