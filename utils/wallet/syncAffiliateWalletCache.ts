import { getWalletBalanceSnapshot } from "@/../utils/wallet/balance";

type WalletSyncQueryResponse = {
  data: Record<string, unknown>[] | Record<string, unknown> | null;
  error: { message?: string | null } | null;
};

type WalletSyncQueryBuilder = PromiseLike<WalletSyncQueryResponse> & {
  select: (columns: string) => WalletSyncQueryBuilder;
  eq: (column: string, value: string) => WalletSyncQueryBuilder;
  maybeSingle: () => Promise<WalletSyncQueryResponse>;
};

type WalletSyncMutationBuilder = PromiseLike<WalletSyncQueryResponse>;

type WalletSyncClient = {
  from: (table: string) => {
    select: (columns: string) => WalletSyncQueryBuilder;
    upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => WalletSyncMutationBuilder;
  };
};

export async function syncAffiliateWalletCache(
  supabase: WalletSyncClient,
  email: string,
) {
  const snapshot = await getWalletBalanceSnapshot(supabase as never, email);

  const { data: existingWallet, error: walletFetchError } = await supabase
    .from("wallets")
    .select(
      "email, role, last_transaction_id, last_transaction_status, last_topup_amount, last_fee_amount, last_net_amount",
    )
    .eq("email", email)
    .eq("role", "affiliate")
    .maybeSingle();

  if (walletFetchError) {
    throw new Error(`wallet cache fetch failed: ${walletFetchError.message || walletFetchError}`);
  }

  const existing =
    existingWallet && !Array.isArray(existingWallet)
      ? (existingWallet as Record<string, unknown>)
      : null;

  const { error: upsertError } = await supabase.from("wallets").upsert(
    {
      email,
      role: "affiliate",
      balance: snapshot.availableBalance,
      last_transaction_id:
        typeof existing?.last_transaction_id === "string"
          ? existing.last_transaction_id
          : null,
      last_transaction_status:
        typeof existing?.last_transaction_status === "string"
          ? existing.last_transaction_status
          : null,
      last_topup_amount:
        typeof existing?.last_topup_amount === "number"
          ? existing.last_topup_amount
          : Number(existing?.last_topup_amount ?? 0),
      last_fee_amount:
        typeof existing?.last_fee_amount === "number"
          ? existing.last_fee_amount
          : Number(existing?.last_fee_amount ?? 0),
      last_net_amount:
        typeof existing?.last_net_amount === "number"
          ? existing.last_net_amount
          : Number(existing?.last_net_amount ?? 0),
    },
    { onConflict: "email" },
  );

  if (upsertError) {
    throw new Error(`wallet cache upsert failed: ${upsertError.message || upsertError}`);
  }

  return snapshot;
}
