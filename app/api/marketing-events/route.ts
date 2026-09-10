import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import { canAccessMarketingDashboard } from "@/../utils/marketing/internalAccess";

const ALLOWED_PAGE_PATHS = new Set([
  "/",
  "/lp/business-demo",
  "/lp/partner-demo",
  "/create-account",
]);

const ALLOWED_EVENT_TYPES = new Set(["page_view", "create_account_start", "business_demo_cta_click"]);

type MetricCounts = {
  pageViews: number;
  createAccountStarts: number;
  businessDemoCtaClicks: number;
};

function emptyCounts(): MetricCounts {
  return {
    pageViews: 0,
    createAccountStarts: 0,
    businessDemoCtaClicks: 0,
  };
}

function getRange(period: string) {
  const now = new Date();

  switch (period) {
    case "24h": {
      return {
        label: "24h",
        from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      };
    }
    case "today": {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return {
        label: "today",
        from,
      };
    }
    case "7d":
      return { label: "7d", from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    case "30d":
      return { label: "30d", from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case "90d":
      return { label: "90d", from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    case "all":
      return { label: "all", from: null };
    default:
      return { label: "30d", from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const eventType = String(body?.eventType || "").trim();
    const pagePath = String(body?.pagePath || "").trim();
    const audience = body?.audience ? String(body.audience).trim() : null;
    const meta =
      body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? body.meta
        : {};

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ ok: false, error: "Invalid event type" }, { status: 400 });
    }

    if (!ALLOWED_PAGE_PATHS.has(pagePath)) {
      return NextResponse.json({ ok: false, error: "Invalid page path" }, { status: 400 });
    }

    const forwardedFor = req.headers.get("x-forwarded-for");
    const userAgent = req.headers.get("user-agent");
    const referrer = req.headers.get("referer");

    const { error } = await (supabaseAdmin as any)
      .from("marketing_site_events")
      .insert({
        event_type: eventType,
        page_path: pagePath,
        audience,
        meta: {
          ...(meta || {}),
          referrer,
          user_agent: userAgent,
          forwarded_for: forwardedFor,
        },
      });

    if (error) {
      console.error("[marketing-events][POST] insert error", error);
      return NextResponse.json({ ok: false, error: "Failed to log event" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[marketing-events][POST] unexpected error", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email || !canAccessMarketingDashboard(user.email)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const period = (url.searchParams.get("period") || "30d").toLowerCase();
    const range = getRange(period);
    const fromIso = range.from ? range.from.toISOString() : null;

    const eventsQuery = (supabaseAdmin as any)
      .from("marketing_site_events")
      .select("event_type, page_path, audience, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    const revenueQuery = (supabaseAdmin as any)
      .from("platform_fee_ledger")
      .select("amount, status, currency, accrued_at")
      .order("accrued_at", { ascending: false })
      .limit(5000);

    const profilesQuery = (supabaseAdmin as any)
      .from("profiles")
      .select("id,email,role,created_at")
      .eq("role", "business")
      .order("created_at", { ascending: false })
      .limit(5000);

    const affiliateProfilesQuery = (supabaseAdmin as any)
      .from("profiles")
      .select("id,email,role,created_at")
      .eq("role", "affiliate")
      .order("created_at", { ascending: false })
      .limit(5000);

    const liveCampaignsQuery = (supabaseAdmin as any)
      .from("live_campaigns")
      .select("id,status,type,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    const offersQuery = (supabaseAdmin as any)
      .from("offers")
      .select("id,title,business_email,created_at,meta_page_id,meta_ad_account_id")
      .order("created_at", { ascending: false })
      .limit(5000);

    const affiliateRequestsQuery = (supabaseAdmin as any)
      .from("affiliate_requests")
      .select("id,offer_id,business_email,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    const productEventsQuery = (supabaseAdmin as any)
      .from("product_events")
      .select("event_type,actor_email,actor_role,offer_id,meta,created_at")
      .eq("actor_role", "business")
      .order("created_at", { ascending: false })
      .limit(5000);

    const [
      eventsResult,
      revenueResult,
      profilesResult,
      affiliateProfilesResult,
      offersResult,
      affiliateRequestsResult,
      liveCampaignsResult,
      productEventsResult,
    ] = await Promise.all([
      fromIso ? eventsQuery.gte("created_at", fromIso) : eventsQuery,
      fromIso ? revenueQuery.gte("accrued_at", fromIso) : revenueQuery,
      fromIso ? profilesQuery.gte("created_at", fromIso) : profilesQuery,
      fromIso ? affiliateProfilesQuery.gte("created_at", fromIso) : affiliateProfilesQuery,
      fromIso ? offersQuery.gte("created_at", fromIso) : offersQuery,
      fromIso ? affiliateRequestsQuery.gte("created_at", fromIso) : affiliateRequestsQuery,
      fromIso ? liveCampaignsQuery.gte("created_at", fromIso) : liveCampaignsQuery,
      fromIso ? productEventsQuery.gte("created_at", fromIso) : productEventsQuery,
    ]);

    const { data, error } = eventsResult;

    if (error) {
      console.error("[marketing-events][GET] select error", error);
      return NextResponse.json({ ok: false, error: "Failed to load events" }, { status: 500 });
    }

    const rows = (data || []) as Array<{
      event_type: string;
      page_path: string;
      audience: string | null;
      meta?: Record<string, unknown> | null;
      created_at: string;
    }>;

    const totals = emptyCounts();
    const byPage: Record<string, MetricCounts> = {};
    const byAudience: Record<string, MetricCounts> = {};
    const bySource: Record<string, MetricCounts> = {};
    const byPlacement: Record<string, MetricCounts> = {};

    for (const row of rows) {
      const eventKey =
        row.event_type === "create_account_start"
          ? "createAccountStarts"
          : row.event_type === "business_demo_cta_click"
            ? "businessDemoCtaClicks"
            : "pageViews";

      totals[eventKey] += 1;

      if (!byPage[row.page_path]) byPage[row.page_path] = emptyCounts();
      byPage[row.page_path][eventKey] += 1;

      const audienceKey = row.audience || "unknown";
      if (!byAudience[audienceKey]) byAudience[audienceKey] = emptyCounts();
      byAudience[audienceKey][eventKey] += 1;

      const sourceKey =
        typeof row.meta?.utm_source === "string"
          ? row.meta.utm_source
          : typeof row.meta?.source === "string"
            ? row.meta.source
            : typeof row.meta?.referrer === "string" && row.meta.referrer
              ? row.meta.referrer
              : "unknown";
      if (!bySource[sourceKey]) bySource[sourceKey] = emptyCounts();
      bySource[sourceKey][eventKey] += 1;

      const placementKey =
        typeof row.meta?.cta_placement === "string" && row.meta.cta_placement
          ? row.meta.cta_placement
          : "unknown";
      if (!byPlacement[placementKey]) byPlacement[placementKey] = emptyCounts();
      byPlacement[placementKey][eventKey] += 1;
    }

    const revenueRows = ((revenueResult?.data as Array<{
      amount: number | string | null;
      status: string | null;
      currency: string | null;
      accrued_at: string;
    }>) || []).filter((row) => row?.accrued_at);

    let revenueTotal = 0;
    for (const row of revenueRows) {
      const amount = Number(row.amount || 0);
      if (Number.isFinite(amount)) revenueTotal += amount;
    }

    const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
    const businessProfiles = ((profilesResult?.data || []) as Array<{
      id: string;
      email: string | null;
      role: string | null;
      created_at: string;
    }>).filter((row) => normalizeEmail(row.email));

    const cohortEmails = new Set(businessProfiles.map((row) => normalizeEmail(row.email)));

    const offerRows = ((offersResult?.data || []) as Array<{
      id: string;
      title: string | null;
      business_email: string | null;
      created_at: string;
      meta_page_id: string | null;
      meta_ad_account_id: string | null;
    }>).filter((row) => cohortEmails.has(normalizeEmail(row.business_email)));

    const requestRows = ((affiliateRequestsResult?.data || []) as Array<{
      id: string;
      offer_id: string | null;
      business_email: string | null;
      status: string | null;
      created_at: string;
    }>).filter((row) => cohortEmails.has(normalizeEmail(row.business_email)));

    const productRows = ((productEventsResult?.data || []) as Array<{
      event_type: string;
      actor_email: string | null;
      actor_role: string | null;
      offer_id: string | null;
      meta?: Record<string, unknown> | null;
      created_at: string;
    }>).filter((row) => cohortEmails.has(normalizeEmail(row.actor_email)));

    const eventEmails = (eventType: string) =>
      new Set(
        productRows
          .filter((row) => row.event_type === eventType)
          .map((row) => normalizeEmail(row.actor_email))
          .filter(Boolean),
      );

    const dashboardReached = eventEmails("business_dashboard_viewed");
    const offerCreateViewed = eventEmails("offer_create_viewed");
    const publishClicked = eventEmails("offer_publish_clicked");
    const publishFailed = eventEmails("offer_publish_failed");
    const publishedByEvent = eventEmails("offer_published");

    const offerPublishedEmails = new Set(
      offerRows.map((row) => normalizeEmail(row.business_email)).filter(Boolean),
    );
    for (const email of publishedByEvent) offerPublishedEmails.add(email);

    const affiliateRequestEmails = new Set(
      requestRows.map((row) => normalizeEmail(row.business_email)).filter(Boolean),
    );

    const metaEnabledEmails = new Set(
      offerRows
        .filter((row) => Boolean(row.meta_page_id && row.meta_ad_account_id))
        .map((row) => normalizeEmail(row.business_email))
        .filter(Boolean),
    );

    const signupCount = businessProfiles.length;
    const countIn = (set: Set<string>) =>
      Array.from(cohortEmails).filter((email) => set.has(email)).length;

    const dashboardCount = countIn(dashboardReached);
    const offerStartedCount = countIn(offerCreateViewed);
    const publishClickedCount = countIn(publishClicked);
    const offerPublishedCount = countIn(offerPublishedEmails);
    const affiliateRequestCount = countIn(affiliateRequestEmails);
    const metaEnabledCount = countIn(metaEnabledEmails);

    const blockers = {
      neverReachedDashboard: Math.max(0, signupCount - dashboardCount),
      dashboardNoOfferStart: Math.max(
        0,
        Array.from(cohortEmails).filter(
          (email) => dashboardReached.has(email) && !offerCreateViewed.has(email),
        ).length,
      ),
      offerStartedNoPublish: Math.max(
        0,
        Array.from(cohortEmails).filter(
          (email) => offerCreateViewed.has(email) && !offerPublishedEmails.has(email),
        ).length,
      ),
      publishFailures: countIn(publishFailed),
      publishedNoAffiliateRequest: Math.max(
        0,
        Array.from(cohortEmails).filter(
          (email) => offerPublishedEmails.has(email) && !affiliateRequestEmails.has(email),
        ).length,
      ),
      publishedNoMeta: Math.max(
        0,
        Array.from(cohortEmails).filter(
          (email) => offerPublishedEmails.has(email) && !metaEnabledEmails.has(email),
        ).length,
      ),
    };

    const recentBusinesses = businessProfiles.slice(0, 30).map((profile) => {
      const email = normalizeEmail(profile.email);
      const businessOffers = offerRows.filter((row) => normalizeEmail(row.business_email) === email);
      const lastEvent = productRows.find((row) => normalizeEmail(row.actor_email) === email);
      return {
        email,
        signedUpAt: profile.created_at,
        dashboardReached: dashboardReached.has(email),
        offerStarted: offerCreateViewed.has(email),
        publishClicked: publishClicked.has(email),
        offerPublished: offerPublishedEmails.has(email),
        affiliateRequest: affiliateRequestEmails.has(email),
        metaEnabled: metaEnabledEmails.has(email),
        offerCount: businessOffers.length,
        lastEvent: lastEvent?.event_type || (businessOffers.length ? "offer_published" : "signup"),
        lastEventAt: lastEvent?.created_at || businessOffers[0]?.created_at || profile.created_at,
      };
    });

    const steps = [
      { key: "signup", label: "Business signups", count: signupCount },
      { key: "dashboard", label: "Dashboard reached", count: dashboardCount },
      { key: "offer_started", label: "Offer builder opened", count: offerStartedCount },
      { key: "publish_clicked", label: "Publish attempted", count: publishClickedCount },
      { key: "offer_live", label: "Offer published", count: offerPublishedCount },
      { key: "affiliate_request", label: "Affiliate request received", count: affiliateRequestCount },
      { key: "meta_enabled", label: "Paid promotion enabled", count: metaEnabledCount },
    ].map((step, index, arr) => ({
      ...step,
      rateFromPrevious:
        index === 0 || !arr[index - 1].count
          ? null
          : Number(((step.count / arr[index - 1].count) * 100).toFixed(1)),
      dropOffFromPrevious:
        index === 0 ? 0 : Math.max(0, arr[index - 1].count - step.count),
    }));

    return NextResponse.json({
      ok: true,
      period: range.label,
      totals,
      byPage,
      byAudience,
      bySource,
      byPlacement,
      recentCount: rows.length,
      revenue: {
        total: Number(revenueTotal.toFixed(2)),
        count: revenueRows.length,
      },
      businessActivation: {
        steps,
        blockers,
        recentBusinesses,
        instrumentationStarted: productRows.length > 0,
      },
      growthSummary: {
        businessSignups: businessProfiles.length,
        affiliateSignups: ((affiliateProfilesResult?.data || []) as Array<unknown>).length,
        offersPublished: offerRows.length,
        affiliateRequests: requestRows.length,
        liveCampaigns: ((liveCampaignsResult?.data || []) as Array<unknown>).length,
        trackedRevenue: Number(revenueTotal.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("[marketing-events][GET] unexpected error", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
