import supabase from "@/../utils/supabase/server-client";
import { getWalletBalanceSnapshot } from "@/../utils/wallet/balance";

export async function getRefundableBalance(email: string) {
  const snapshot = await getWalletBalanceSnapshot(supabase, email);
  return snapshot.refundableBalance;
}
