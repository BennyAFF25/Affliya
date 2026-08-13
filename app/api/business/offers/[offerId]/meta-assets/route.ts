import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function clean(value: unknown) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> },
) {
  try {
    const { offerId } = await params;
    const body = await req.json().catch(() => null);
    const cookieStore = cookies();
    const userSupabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user?.email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const metaPageId = clean(body?.metaPageId);
    const metaAdAccountId = clean(body?.metaAdAccountId);
    const metaPixelId = clean(body?.metaPixelId);

    if (!metaPageId || !metaAdAccountId) {
      return NextResponse.json(
        { success: false, error: "MISSING_META_ASSETS", message: "Choose both a Meta page and ad account." },
        { status: 400 },
      );
    }

    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id,business_email,title")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) throw offerError;

    if (!offer || (offer as { business_email?: string | null }).business_email !== user.email) {
      return NextResponse.json({ success: false, error: "OFFER_NOT_FOUND" }, { status: 404 });
    }

    const { data: pageConnection, error: pageError } = await supabase
      .from("meta_connections")
      .select("page_id,page_name")
      .eq("business_email", user.email)
      .eq("page_id", metaPageId)
      .limit(1)
      .maybeSingle();

    if (pageError) throw pageError;

    const { data: adAccountConnection, error: adAccountError } = await supabase
      .from("meta_connections")
      .select("ad_account_id,ad_account_name")
      .eq("business_email", user.email)
      .eq("ad_account_id", metaAdAccountId)
      .limit(1)
      .maybeSingle();

    if (adAccountError) throw adAccountError;

    if (!pageConnection || !adAccountConnection) {
      return NextResponse.json(
        {
          success: false,
          error: "META_ASSET_NOT_CONNECTED",
          message: "Those Meta assets are not connected to this business account.",
          debug: { metaPageId, metaAdAccountId },
        },
        { status: 400 },
      );
    }

    const pixelName = clean(body?.metaPixelName);

    const updatePayload = {
      meta_page_id: metaPageId,
      meta_page_name: (pageConnection as { page_name?: string | null }).page_name || clean(body?.metaPageName),
      meta_ad_account_id: metaAdAccountId,
      meta_ad_account_name: (adAccountConnection as { ad_account_name?: string | null }).ad_account_name || clean(body?.metaAdAccountName),
      meta_pixel_id: metaPixelId,
      meta_pixel_name: pixelName,
    };

    const { error: updateError } = await supabase
      .from("offers")
      .update(updatePayload)
      .eq("id", offerId)
      .eq("business_email", user.email);

    if (updateError) throw updateError;

    const { data: verified, error: verifyError } = await supabase
      .from("offers")
      .select("id,title,meta_page_id,meta_page_name,meta_ad_account_id,meta_ad_account_name,meta_pixel_id,meta_pixel_name")
      .eq("id", offerId)
      .eq("business_email", user.email)
      .maybeSingle();

    if (verifyError) throw verifyError;

    const saved = Boolean(
      (verified as { meta_page_id?: string | null; meta_ad_account_id?: string | null } | null)?.meta_page_id === metaPageId &&
      (verified as { meta_page_id?: string | null; meta_ad_account_id?: string | null } | null)?.meta_ad_account_id === metaAdAccountId,
    );

    console.log("[business/offers/meta-assets] saved", {
      offerId,
      businessEmail: user.email,
      saved,
      metaPageId: (verified as any)?.meta_page_id,
      metaAdAccountId: (verified as any)?.meta_ad_account_id,
      metaPixelId: (verified as any)?.meta_pixel_id,
    });

    return NextResponse.json({
      success: saved,
      saved,
      offer: verified,
      message: saved ? "Meta assets saved to offer." : "Meta assets update did not persist.",
    }, { status: saved ? 200 : 500 });
  } catch (error) {
    console.error("[business/offers/meta-assets]", error);
    return NextResponse.json(
      {
        success: false,
        error: "META_ASSET_SAVE_FAILED",
        message: error instanceof Error ? error.message : "Could not save Meta assets.",
      },
      { status: 500 },
    );
  }
}
