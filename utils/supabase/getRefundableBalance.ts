import supabase from "@/../utils/supabase/server-client";

export async function getRefundableBalance(email: string) {
  // 1. Sum succeeded top-ups
  const { data: topupData, error: topupError } = await supabase
    .from("wallet_topups")
    .select("amount_net")
    .eq("affiliate_email", email)
    .eq("status", "succeeded");

  if (topupError) throw new Error("Failed to fetch top-ups");

  const totalTopups = topupData.reduce(
    (sum, row) => sum + (row.amount_net || 0),
    0
  );

  // 2. Sum spends
  const { data: spendData, error: spendError } = await supabase
    .from("wallet_spends")
    .select("amount")
    .eq("affiliate_email", email)
    .eq("status", "succeeded");

  if (spendError) throw new Error("Failed to fetch spends");

  const totalSpends = spendData.reduce(
    (sum, row) => sum + (row.amount || 0),
    0
  );

  // 3. Sum prior refunds
  const { data: refundData, error: refundError } = await supabase
    .from("wallet_refunds")
    .select("amount")
    .eq("affiliate_email", email)
    .eq("status", "succeeded");

  if (refundError) throw new Error("Failed to fetch refunds");

  const totalRefunds = refundData.reduce(
    (sum, row) => sum + (row.amount || 0),
    0
  );

  // 4. Calculate available balance
  const available = totalTopups - totalSpends - totalRefunds;

  return available;
}