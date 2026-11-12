import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../utils/supabase/createServerClient";

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
export function sameOrigin(req: Request) { if (req.headers.get('origin') !== new URL(req.url).origin) throw new Error('forbidden'); }
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
