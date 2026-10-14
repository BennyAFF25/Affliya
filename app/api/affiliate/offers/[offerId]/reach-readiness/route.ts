import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../../utils/businessSubscriptions";
import { resolveReachConnection } from "../../../../../../utils/meta/reachConnection";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ offerId: string }> }) {
  try {
    const client = createRouteHandlerClient({ cookies });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user?.email) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const { offerId } = await context.params;
    const connection = await resolveReachConnection(createServerSupabaseClient(), offerId);
    return NextResponse.json({ ready: Boolean(connection) });
  } catch {
    return NextResponse.json({ error: "REACH_READINESS_UNAVAILABLE" }, { status: 503 });
  }
}
