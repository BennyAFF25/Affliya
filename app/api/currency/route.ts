import { NextResponse } from 'next/server';
import { paidLaunchCurrencies } from '../../../utils/currency/paidCurrencyGuard';
import { getAudRate, fxBufferBps } from '../../../utils/fx/rates';
import { audHoldAmount } from '../../../utils/wallet/launchHolds';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const currency = (query.get('currency') || '').toUpperCase();
  const amount = Number(query.get('amount'));
  let holdAudEstimate: number | null = null;
  if (['USD','GBP','CAD'].includes(currency) && Number.isFinite(amount) && amount > 0 && amount <= 10000000) {
    try { const rate = await getAudRate(currency); holdAudEstimate = audHoldAmount(amount, rate.rate, fxBufferBps()); } catch { /* Hide unavailable estimates. */ }
  }
  return NextResponse.json({ paidLaunchCurrencies: paidLaunchCurrencies(), holdAudEstimate });
}
