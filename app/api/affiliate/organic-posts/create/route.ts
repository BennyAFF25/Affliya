import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";
import { assertAffiliateOfferApproved } from "../../../../../utils/approvals/enforcement";
import { organicCaptionError, ORGANIC_CAPTION_TYPE_ERROR } from "../../../../../utils/organicCaption";

export async function POST(req: Request) {
  try {
    const client = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user?.email) return NextResponse.json({ message: "Sign in as an affiliate." }, { status: 401 });
    const input = await req.json().catch(() => ({}));
    const captionError = typeof input.caption !== "string" ? ORGANIC_CAPTION_TYPE_ERROR : organicCaptionError(input.caption);
    if (captionError) return NextResponse.json({ message: captionError }, { status: 400 });
    const admin = createServerSupabaseClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "affiliate") return NextResponse.json({ message: "An affiliate account is required." }, { status: 403 });
    const { data: offer, error } = await admin.from("offers").select("id,business_email").eq("id", input.offer_id).is("archived_at", null).maybeSingle();
    if (error) throw error;
    if (!offer) return NextResponse.json({ message: "Offer not found." }, { status: 404 });
    const approval = await assertAffiliateOfferApproved(admin as never, { offerId: offer.id, affiliateEmail: user.email });
    if (!approval.ok) return NextResponse.json({ message: approval.message }, { status: approval.status });
    const { data, error: insertError } = await admin.from("organic_posts").insert({
      offer_id: offer.id, user_id: user.id, affiliate_email: user.email, business_email: offer.business_email,
      caption: input.caption, platform: input.platform || null, image_url: input.image_url || null,
      video_url: input.video_url || null, business_creative_id: input.business_creative_id || null, status: "pending",
    }).select("id").single();
    if (insertError) throw insertError;
    return NextResponse.json({ success: true, id: data.id });
  } catch {
    return NextResponse.json({ message: "Could not submit the organic post. Please retry." }, { status: 500 });
  }
}
