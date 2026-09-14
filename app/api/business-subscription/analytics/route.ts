import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import {
  isBusinessSubscriptionAnalyticsEvent,
  trackBusinessSubscriptionAnalytics,
} from "../../../../utils/businessSubscriptionAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const eventType = String(body?.eventType || "").trim();
    if (!isBusinessSubscriptionAnalyticsEvent(eventType)) {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData } = await userSupabase.auth.getUser();
    const user = authData?.user || null;
    if (!user?.email) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const admin = createServerSupabaseClient();
    await trackBusinessSubscriptionAnalytics({
      supabase: admin,
      eventType,
      businessId: body?.businessId || null,
      businessEmail: user.email,
      campaignId: body?.campaignId || null,
      intendedAction: body?.intendedAction || null,
      submissionId: body?.submissionId || null,
      returnTo: body?.returnTo || null,
      attribution: body?.attribution && typeof body.attribution === "object" ? body.attribution : {},
      metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });

    // Both business review queues already fire campaign_review_opened when the
    // business clicks "View details". Persist that event on the actual submission
    // so the affiliate can see that their work has genuinely been opened.
    if (eventType === "campaign_review_opened" && body?.submissionId) {
      const submissionId = String(body.submissionId);
      const viewedAt = new Date().toISOString();
      const intendedAction = String(body?.intendedAction || "");
      const tables = intendedAction === "approve_organic_post"
        ? ["organic_posts"]
        : intendedAction === "approve_ad_idea"
          ? ["ad_ideas"]
          : ["ad_ideas", "organic_posts"];

      for (const table of tables) {
        const { error } = await (admin as any)
          .from(table)
          .update({ business_viewed_at: viewedAt })
          .eq("id", submissionId)
          .eq("business_email", user.email)
          .is("business_viewed_at", null);

        if (error) {
          console.warn("[business-subscription/analytics] submission view stamp failed", {
            table,
            submissionId,
            message: error.message,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[business-subscription/analytics] unexpected", err);
    return NextResponse.json({ ok: true });
  }
}
