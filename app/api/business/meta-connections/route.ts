import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/supabase/createServerClient";
import { META_CONNECTION_PUBLIC_COLUMNS } from "../../../../utils/meta/loadOwnMetaConnections";

export const dynamic = "force-dynamic";


/** The signed-in business's own Meta connections (meta_connections is service_role only). */
export async function GET() {
  const userSupabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createServerSupabaseClient();
  const { data, error } = await admin
    .from("meta_connections")
    .select(META_CONNECTION_PUBLIC_COLUMNS)
    .eq("business_email", user.email)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[meta-connections] load failed", { code: error.code || null });
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
  return NextResponse.json({ connections: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
