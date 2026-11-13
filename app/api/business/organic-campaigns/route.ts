import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { approveOrganicPost } from "../../../../utils/organicCampaignApproval";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

type OrganicCampaignRequest = {
  offerId?: string;
  businessEmail?: string;
  affiliateEmail?: string;
  mediaUrl?: string | null;
  caption?: string | null;
  platform?: string | null;
  submissionId?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as OrganicCampaignRequest | null;
    const offerId = body?.offerId;
    const affiliateEmail = body?.affiliateEmail;
    const businessEmail = body?.businessEmail;

    if (!offerId || !affiliateEmail || !businessEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_REQUIRED_FIELDS",
          message: "Missing offer, affiliate, or business context for organic campaign launch.",
        },
        { status: 400 },
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHENTICATED",
          message: "Sign in as the offer business before launching this campaign.",
        },
        { status: 401 },
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const userEmail = authData?.user?.email;

    if (authError || !userEmail || userEmail !== businessEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Only the offer business can launch this organic campaign.",
        },
        { status: 403 },
      );
    }

    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("business_email")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) {
      console.error("[organic-campaigns] offer lookup failed", offerError);
      return NextResponse.json(
        {
          success: false,
          error: "OFFER_LOOKUP_FAILED",
          message: "Failed to verify the offer business before launch.",
        },
        { status: 500 },
      );
    }

    if (!offer || offer.business_email !== businessEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "OFFER_BUSINESS_MISMATCH",
          message: "Only the offer business can launch this organic campaign.",
        },
        { status: 403 },
      );
    }

    if (!body?.submissionId) return NextResponse.json({ success: false, message: "A post submission is required." }, { status: 400 });
    const result = await approveOrganicPost(supabase, body.submissionId, {
      context: { offerId, businessEmail, affiliateEmail },
    });
    return NextResponse.json(result, { status: result.success ? 200 : result.status });
  } catch (error) {
    console.error("[organic-campaigns] unexpected error", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Failed to create the organic campaign.",
      },
      { status: 500 },
    );
  }
}
