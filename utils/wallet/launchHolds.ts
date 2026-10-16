/* eslint-disable @typescript-eslint/no-explicit-any */
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

export async function reserveLaunchHold(client: any, email: string, amount: number, referenceId: string) {
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
