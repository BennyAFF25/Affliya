import type { SupabaseClient } from "@supabase/supabase-js";
/** Server-only connection resolution. Never serialize accessToken to the browser. */
export async function resolveReachConnection(admin: SupabaseClient, offerId: string) {
  const offer = await admin.from("offers").select("business_email,meta_page_id,meta_ad_account_id").eq("id", offerId).maybeSingle();
  if (offer.error) throw offer.error;
  if (!offer.data?.business_email || !offer.data.meta_page_id || !offer.data.meta_ad_account_id) return null;
  const accountId = String(offer.data.meta_ad_account_id).replace(/^act_/, "");
  const connections = await admin.from("meta_connections").select("access_token,ad_account_id,created_at")
    .eq("business_email", offer.data.business_email).eq("page_id", offer.data.meta_page_id)
    .order("created_at", { ascending: false });
  if (connections.error) throw connections.error;
  const chosen = connections.data?.find(row => String(row.ad_account_id || "").replace(/^act_/, "") === accountId && String(row.access_token || "").trim());
  return chosen ? { accountId, accessToken: String(chosen.access_token).trim() } : null;
}
