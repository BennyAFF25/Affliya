import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const businessEmails: string[] = Array.isArray(body?.businessEmails)
    ? body.businessEmails
    : [];

  const uniqueBusinesses = Array.from(
    new Set(
      businessEmails
        .filter((email: unknown): email is string => typeof email === "string")
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  );

  if (uniqueBusinesses.length === 0) {
    return NextResponse.json(
      { error: "no_offers", message: "Need at least one approved offer." },
      { status: 400 },
    );
  }

  const { data: pendingRow } = await supabase
    .from("affiliate_shop_requests")
    .select("id")
    .eq("affiliate_email", user.email)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pendingRow) {
    return NextResponse.json(
      {
        error: "already_pending",
        message: "You already have a pending request.",
      },
      { status: 409 },
    );
  }

  const rows = uniqueBusinesses.map((businessEmail) => ({
    affiliate_email: user.email,
    business_email: businessEmail,
    status: "pending" as const,
    message:
      "This affiliate is requesting to have a shop link which will display your offer and any others they work with on a storefront used for organic campaigns and social media links.",
  }));

  const { error } = await supabase.from("affiliate_shop_requests").insert(rows);

  if (error) {
    console.error("[shop-request] insert failed", error);
    return NextResponse.json(
      { error: "db_error", message: "Failed to submit request." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
