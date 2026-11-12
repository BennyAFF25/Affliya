import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../utils/supabase/createServerClient";

export const NONCE_COOKIE = "shopify_oauth_nonce";
export const BUSINESS_PAGE = "/business/my-business";
export function webhookBaseUrl(req: Request): string {
  return new URL(process.env.NEXT_PUBLIC_BASE_URL?.trim() || req.url).origin;
}
export async function requireBusiness() {
  const session = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user?.email) throw new Error("unauthorized");
  const admin = createServerSupabaseClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error("database");
  if (profile?.role !== "business") throw new Error("forbidden");
  const { data: business, error: businessError } = await admin.from("business_profiles").select("id").eq("business_email", user.email).maybeSingle();
  if (businessError) throw new Error("database");
  if (!business) throw new Error("business_profile_required");
  return { user, businessId: business.id as string, admin };
}
export function errorReason(error: unknown): string {
  const allowed = ["unauthorized", "forbidden", "business_profile_required", "invalid_shop", "invalid_hmac", "invalid_state", "session_mismatch", "missing_code", "missing_scopes", "token_exchange", "shop_already_connected", "database", "configuration", "invalid_scopes_configuration"];
  return error instanceof Error && allowed.includes(error.message) ? error.message : "connection_failed";
}
export function errorStatus(reason: string): number {
  return reason === "unauthorized" ? 401 : reason === "forbidden" ? 403 : reason === "database" || reason === "configuration" ? 503 : 400;
}
