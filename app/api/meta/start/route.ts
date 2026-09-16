import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.nettmark.com";
const REDIRECT_URI = `${BASE_URL}/api/meta/callback`;
const DEFAULT_RETURN_TO = "/business/my-business/connect-meta";

const META_SCOPES = [
  "pages_show_list",
  "ads_management",
  "business_management",
  "pages_read_engagement",
  "pages_read_user_content",
  "ads_read",
  "pages_manage_ads",
].join(",");

function safeReturnTo(value: string | null) {
  if (!value) return DEFAULT_RETURN_TO;
  if (!value.startsWith("/business/") || value.startsWith("//")) {
    return DEFAULT_RETURN_TO;
  }
  return value;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const returnTo = safeReturnTo(searchParams.get("returnTo"));

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.info("[meta-oauth] authorization_started", {
      hasNettmarkSession: Boolean(user),
      returnTo,
      redirectUri: REDIRECT_URI,
      graphVersion: "v19.0",
    });

    const state = Buffer.from(returnTo, "utf8").toString("base64");
    const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    url.searchParams.set("client_id", META_APP_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", META_SCOPES);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[meta-oauth] authorization_start_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.redirect(
      new URL(`${DEFAULT_RETURN_TO}?meta_error=authorization_start`, BASE_URL),
    );
  }
}
