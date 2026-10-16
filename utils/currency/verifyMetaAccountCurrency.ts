/* eslint-disable @typescript-eslint/no-explicit-any */
export async function verifyMetaAccountCurrency(params: { supabase: any; businessEmail: string;
  pageId: string; adAccountId: string; token: string; offerCurrency: string; fetcher?: typeof fetch }) {
  if (!params.token || !/^(act_)?\d+$/.test(params.adAccountId)) throw new Error('Unable to verify Meta ad account currency. Reconnect Meta and try again.');
  let currency: string;
  try {
    const account = params.adAccountId.replace(/^act_/, '');
    const response = await (params.fetcher ?? fetch)(`https://graph.facebook.com/v21.0/act_${account}?fields=currency`, {
      headers: { Authorization: `Bearer ${params.token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (!response.ok || !/^[A-Z]{3}$/.test(body.currency)) throw new Error();
    currency = body.currency;
  } catch { throw new Error('Unable to verify live Meta ad account currency. Please try again before launching or resuming.'); }
  if (currency !== String(params.offerCurrency).trim().toUpperCase()) throw new Error(`Currency mismatch: offer ${params.offerCurrency}, live Meta ad account ${currency}. Select a matching ad account before launching.`);
  const saved = await params.supabase.from('meta_connections').update({ ad_account_currency: currency })
    .eq('business_email', params.businessEmail).eq('page_id', params.pageId).eq('ad_account_id', params.adAccountId);
  if (saved.error) throw new Error('Unable to save verified Meta currency. Please try again.');
  return currency;
}
