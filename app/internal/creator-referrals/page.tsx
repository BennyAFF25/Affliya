import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Row = Record<string, any>;

function money(cents?: number | null, currency = "aud") {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: currency.toUpperCase() }).format(amount);
}

function cell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export default async function InternalCreatorReferralsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;
  const requiredKey = process.env.INTERNAL_CREATOR_REFERRALS_KEY || process.env.INTERNAL_MARKETING_KEY || "";

  if (requiredKey && key !== requiredKey) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold">Creator referrals</h1>
          <p className="mt-3 text-white/60">Protected internal proof page. Add the configured access key to view referral attribution and commission ledger data.</p>
        </div>
      </main>
    );
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return <main className="min-h-screen bg-black p-8 text-white">Missing Supabase server env.</main>;
  }

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

  const [partners, attributions, commissions] = await Promise.all([
    supabase.from("creator_partners").select("id,display_name,partner_email,referral_code,status,commission_percentage,commission_duration_months,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("business_creator_attributions").select("id,business_id,business_email,creator_partner_id,referral_code,attributed_at,attribution_source,landing_session_id,first_subscription_id").order("attributed_at", { ascending: false }).limit(100),
    supabase.from("creator_commission_ledger").select("id,creator_partner_id,business_id,stripe_invoice_id,stripe_subscription_id,gross_eligible_subscription_amount,commission_percentage,commission_amount,currency,commission_month_number,status,eligibility_date,reversal_reason").order("created_at", { ascending: false }).limit(100),
  ]);

  const rows = {
    partners: (partners.data || []) as Row[],
    attributions: (attributions.data || []) as Row[],
    commissions: (commissions.data || []) as Row[],
  };

  const pendingTotal = rows.commissions
    .filter((row) => row.status === "pending" || row.status === "payable")
    .reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
  const paidTotal = rows.commissions
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);

  return (
    <main className="min-h-screen bg-[#05080b] px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h1 className="text-2xl font-semibold text-[#7ff5fb]">Creator referral proof view</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/60">Internal Rollout 4 verification only: referred signups, activated subscriptions, pending commission, and paid commission. No payout controls exist here.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Stat label="Creator partners" value={rows.partners.length} />
            <Stat label="Referred businesses" value={rows.attributions.length} />
            <Stat label="Pending/payable" value={money(pendingTotal)} />
            <Stat label="Paid" value={money(paidTotal)} />
          </div>
        </section>

        <Table title="Creator partners" rows={rows.partners} columns={["display_name", "partner_email", "referral_code", "status", "commission_percentage", "commission_duration_months", "created_at"]} />
        <Table title="Business attributions" rows={rows.attributions} columns={["business_email", "referral_code", "creator_partner_id", "attributed_at", "attribution_source", "landing_session_id", "first_subscription_id"]} />
        <Table title="Commission ledger" rows={rows.commissions} columns={["stripe_invoice_id", "business_id", "creator_partner_id", "gross_eligible_subscription_amount", "commission_percentage", "commission_amount", "currency", "commission_month_number", "status", "eligibility_date", "reversal_reason"]} moneyColumns={["gross_eligible_subscription_amount", "commission_amount"]} />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Table({ title, rows, columns, moneyColumns = [] }: { title: string; rows: Row[]; columns: string[]; moneyColumns?: string[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.16em] text-white/45">
            <tr>{columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.length ? rows.map((row) => (
              <tr key={row.id || JSON.stringify(row)} className="align-top text-white/75">
                {columns.map((column) => (
                  <td key={column} className="max-w-[260px] truncate px-4 py-3">
                    {moneyColumns.includes(column) ? money(row[column], row.currency || "aud") : cell(row[column])}
                  </td>
                ))}
              </tr>
            )) : (
              <tr><td className="px-4 py-6 text-white/45" colSpan={columns.length}>No rows yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
