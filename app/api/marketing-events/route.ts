import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import { canAccessMarketingDashboard } from "@/../utils/marketing/internalAccess";
import { aggregateMarketingReport, aggregateFees } from "@/../utils/marketing/reporting";

const ALLOWED_PAGE_PATHS = new Set([
  "/",
  "/lp/business-demo",
  "/lp/partner-demo",
  "/create-account",
]);

const ALLOWED_EVENT_TYPES = new Set(["page_view", "create_account_start", "business_demo_cta_click"]);
import { aggregateBusinessFunnel } from "../../../utils/marketing/businessFunnel";
import { BUSINESS_GROWTH_TRIAL_DAYS, getGrowthSubscriptionPrice } from "../../../utils/businessSubscriptions";

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
      from.setUTCHours(0, 0, 0, 0);
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
    const generatedAt = new Date().toISOString();
    const parseDate = (name: string) => {
      const value = url.searchParams.get(name);
      if (!value) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || (!Number.isFinite(Date.parse(value + "T00:00:00.000Z")) || new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) !== value)) throw new Error("invalid cohort date");
      return value + "T00:00:00.000Z";
    };
    let signupFrom: string | null, signupTo: string, observedThrough: string;
    try {
      signupFrom = parseDate("signupFrom") || fromIso;
      signupTo = parseDate("signupTo") || generatedAt;
      observedThrough = parseDate("observedThrough") || generatedAt;
      if ((signupFrom && signupFrom >= signupTo) || observedThrough > generatedAt) throw new Error("invalid range");
    } catch { return NextResponse.json({ ok: false, error: "Use valid UTC signup dates (end exclusive) and an observation date no later than today." }, { status: 400 }); }
    const outcomes = (query: any) => signupFrom ? query.gte("created_at", signupFrom).lte("created_at", observedThrough) : query.lte("created_at", observedThrough);
    const metaConnectionsQuery = (supabaseAdmin as any).from("meta_connections").select("business_email,ad_account_id,page_id,created_at").order("created_at", { ascending: false }).limit(5000);
    const paidCampaignsQuery = (supabaseAdmin as any).from("live_ads").select("id,business_id,business_email,meta_ad_id,meta_campaign_id,spend,created_at").order("created_at", { ascending: false }).limit(5000);
    const stripeEventsQuery = (supabaseAdmin as any).from("business_subscription_stripe_events").select("business_id,event_type,processing_status,metadata,received_at").order("received_at", { ascending: false }).limit(5000);

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

    const entitlementsQuery = (supabaseAdmin as any)
      .from("business_entitlements")
      .select("business_id,business_email,billing_status,subscription_started_at,growth_trial_used,growth_trial_started_at,subscription_cancelled_at")
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
      entitlementsResult,
      metaConnectionsResult,
      paidCampaignsResult,
      stripeEventsResult,
    ] = await Promise.all([
      fromIso ? eventsQuery.gte("created_at", fromIso).lte("created_at", generatedAt) : eventsQuery.lte("created_at", generatedAt),
      fromIso ? revenueQuery.gte("accrued_at", fromIso).lte("accrued_at", generatedAt) : revenueQuery.lte("accrued_at", generatedAt),
      signupFrom ? profilesQuery.gte("created_at", signupFrom).lt("created_at", signupTo).lte("created_at", observedThrough) : profilesQuery.lt("created_at", signupTo).lte("created_at", observedThrough),
      fromIso ? affiliateProfilesQuery.gte("created_at", fromIso).lte("created_at", generatedAt) : affiliateProfilesQuery.lte("created_at", generatedAt),
      outcomes(offersQuery),
      outcomes(affiliateRequestsQuery),
      fromIso ? liveCampaignsQuery.gte("created_at", fromIso).lte("created_at", generatedAt) : liveCampaignsQuery.lte("created_at", generatedAt),
      outcomes(productEventsQuery),
      entitlementsQuery,
      outcomes(metaConnectionsQuery),
      outcomes(paidCampaignsQuery),
      signupFrom ? stripeEventsQuery.gte("received_at", signupFrom).lte("received_at", observedThrough) : stripeEventsQuery.lte("received_at", observedThrough),
    ]);

    const queryResults = [
      ["Website events", eventsResult], ["Fee ledger", revenueResult],
      ["Business profiles", profilesResult], ["Affiliate profiles", affiliateProfilesResult],
      ["Offers", offersResult], ["Affiliate requests", affiliateRequestsResult],
      ["Campaigns", liveCampaignsResult], ["Product events", productEventsResult],
      ["Subscriptions", entitlementsResult], ["Meta connections", metaConnectionsResult], ["Paid campaigns", paidCampaignsResult], ["Signed subscription events", stripeEventsResult],
    ] as const;
    const failed = queryResults.filter(([, result]) => result.error);
    if (failed.length) {
      console.error("[marketing-events][GET] data source errors", failed.map(([name]) => name));
      return NextResponse.json(
        { ok: false, error: `Could not load: ${failed.map(([name]) => name).join(", ")}. Please retry.` },
        { status: 500 },
      );
    }
    const limitedSources = queryResults.filter(([, result]) => (result.data?.length || 0) >= 5000).map(([name]) => name);
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

    const revenueRows = ((revenueResult.data || []) as Array<{
      amount: number | string | null;
      currency: string | null;
      accrued_at: string;
    }>).filter((row) => row.accrued_at);
    const fees = aggregateFees(revenueRows);
    const revenueTotal = fees.total;

    const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
    const businessProfiles = ((profilesResult?.data || []) as Array<{
      id: string;
      email: string | null;
      role: string | null;
      created_at: string;
    }>).filter((row) => normalizeEmail(row.email));

    const businessFunnel = aggregateBusinessFunnel({
      businesses: businessProfiles, offers: offersResult.data || [], events: productEventsResult.data || [],
      requests: affiliateRequestsResult.data || [], metaConnections: metaConnectionsResult.data || [],
      paidCampaigns: paidCampaignsResult.data || [], entitlements: entitlementsResult.data || [], stripeEvents: stripeEventsResult.data || [],
      signupFrom, signupTo, observedThrough, trialDays: BUSINESS_GROWTH_TRIAL_DAYS,
    });
    const currentPrice = await getGrowthSubscriptionPrice().catch(() => null);

    const cohortEmails = new Set(businessProfiles.map((row) => normalizeEmail(row.email)));
    const { totals, byPage, bySource, byPlacement, byAudience, audienceBreakdowns, timeline } = aggregateMarketingReport({
      events: rows,
      businesses: businessProfiles,
      affiliates: (affiliateProfilesResult.data || []) as Array<{ created_at: string }>,
      from: fromIso,
      to: generatedAt,
      hourly: range.label === "24h" || range.label === "today",
    });

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

    const entitlementRows = ((entitlementsResult?.data || []) as Array<{
      business_email: string | null;
      billing_status: string | null;
      subscription_started_at: string | null;
      growth_trial_used: boolean | null;
      growth_trial_started_at: string | null;
      subscription_cancelled_at: string | null;
    }>).filter((row) => cohortEmails.has(normalizeEmail(row.business_email)));

    // The revenue scenario is based on trial start date, rather than signup date.
    // A trial can begin weeks after the business first created its account.
    const trialCohort = ((entitlementsResult?.data || []) as typeof entitlementRows).filter((row) =>
      row.growth_trial_used && row.growth_trial_started_at &&
      (!fromIso || row.growth_trial_started_at >= fromIso) && row.growth_trial_started_at <= generatedAt,
    );
    const trialing = trialCohort.filter((row) => row.billing_status === "subscription_trialing");
    const cancellationMarked = trialing.filter((row) => Boolean(row.subscription_cancelled_at)).length;
    const withoutCancellation = trialing.length - cancellationMarked;

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
    const planChoiceReached = eventEmails("plan_choice_viewed");
    const planFreeClicked = eventEmails("plan_free_clicked");
    const planGrowthClicked = eventEmails("plan_growth_clicked");
    const growthCheckoutStarted = eventEmails("plan_growth_checkout_started");
    const growthActivatedByEvent = eventEmails("plan_growth_activated");

    const growthTrialStartedByEntitlement = new Set(
      entitlementRows
        .filter((row) => Boolean(row.growth_trial_used && row.growth_trial_started_at))
        .map((row) => normalizeEmail(row.business_email))
        .filter(Boolean),
    );

    const growthActiveByEntitlement = new Set(
      entitlementRows
        .filter((row) => row.billing_status === "subscription_active" || row.billing_status === "subscription_trialing")
        .map((row) => normalizeEmail(row.business_email))
        .filter(Boolean),
    );
    // Current active/trialing status is distinct from historical activation.

    const offerPublishedEmails = new Set(
      offerRows.map((row) => normalizeEmail(row.business_email)).filter(Boolean),
    );
    // Persisted offers, not client events, prove publication.

    const affiliateRequestEmails = new Set(
      requestRows.map((row) => normalizeEmail(row.business_email)).filter(Boolean),
    );

    const metaEnabledEmails = new Set<string>(
      (metaConnectionsResult.data || []).filter((row: any) => row.ad_account_id && row.page_id && cohortEmails.has(normalizeEmail(row.business_email)))
        .map((row: any) => normalizeEmail(row.business_email)),
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

    const dashboardActionRows = productRows.filter((row) => row.event_type === "dashboard_action_clicked");
    const actionMap = new Map<string, {
      action: string;
      label: string;
      destination: string | null;
      count: number;
      businesses: Set<string>;
    }>();

    for (const row of dashboardActionRows) {
      const action = typeof row.meta?.action === "string" && row.meta.action ? row.meta.action : "unknown_action";
      const label = typeof row.meta?.label === "string" && row.meta.label ? row.meta.label : action.replace(/_/g, " ");
      const destination = typeof row.meta?.destination === "string" ? row.meta.destination : null;
      const current = actionMap.get(action) || { action, label, destination, count: 0, businesses: new Set<string>() };
      current.count += 1;
      const email = normalizeEmail(row.actor_email);
      if (email) current.businesses.add(email);
      actionMap.set(action, current);
    }

    const dashboardActions = Array.from(actionMap.values())
      .map((item) => ({
        action: item.action,
        label: item.label,
        destination: item.destination,
        count: item.count,
        uniqueBusinesses: item.businesses.size,
      }))
      .sort((a, b) => b.uniqueBusinesses - a.uniqueBusinesses || b.count - a.count)
      .slice(0, 12);

    const firstDashboardActionByEmail = new Map<string, { action: string; label: string; at: string }>();
    for (const row of [...dashboardActionRows].reverse()) {
      const email = normalizeEmail(row.actor_email);
      if (!email || firstDashboardActionByEmail.has(email)) continue;
      const action = typeof row.meta?.action === "string" && row.meta.action ? row.meta.action : "unknown_action";
      const label = typeof row.meta?.label === "string" && row.meta.label ? row.meta.label : action.replace(/_/g, " ");
      firstDashboardActionByEmail.set(email, { action, label, at: row.created_at });
    }

    const recentBusinesses = businessProfiles.slice(0, 30).map((profile) => {
      const email = normalizeEmail(profile.email);
      const businessOffers = offerRows.filter((row) => normalizeEmail(row.business_email) === email);
      const businessProductRows = productRows.filter((row) => normalizeEmail(row.actor_email) === email);
      const lastEvent = [
        { event_type: "signup", created_at: profile.created_at },
        ...businessProductRows.slice(0, 1),
        ...businessOffers.slice(0, 1).map((row) => ({ event_type: "offer_published", created_at: row.created_at })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const firstDashboardAction = firstDashboardActionByEmail.get(email) || null;
      const planChoice = planGrowthClicked.has(email) ? "growth" : planFreeClicked.has(email) ? "free" : null;

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
        planChoice,
        growthCheckoutStarted: growthCheckoutStarted.has(email),
        growthTrialStarted: growthTrialStartedByEntitlement.has(email),
        growthActivated: growthActiveByEntitlement.has(email),
        firstDashboardAction,
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
      { key: "meta_enabled", label: "Meta connected", count: metaEnabledCount },
    ].map((step) => ({
      ...step,
      // These are independent signup-cohort milestones, not adjacent conversions.
      rateFromPrevious: null,
      dropOffFromPrevious: 0,
    }));

    const planReachedCount = countIn(planChoiceReached);
    const freeClickedCount = countIn(planFreeClicked);
    const growthClickedCount = countIn(planGrowthClicked);
    const growthCheckoutCount = countIn(growthCheckoutStarted);
    const growthTrialStartedCount = countIn(growthTrialStartedByEntitlement);
    const growthActivatedCount = countIn(growthActiveByEntitlement);

    return NextResponse.json({
      ok: true,
      period: range.label,
      generatedAt,
      range: { from: fromIso, to: generatedAt, timezone: "UTC" },
      dataQuality: { rowLimit: 5000, limitedSources },
      businessFunnel,
      timeline,
      audienceBreakdowns,
      totals,
      byPage,
      byAudience,
      bySource,
      byPlacement,
      recentCount: rows.length,
      revenue: fees,
      businessActivation: {
        steps,
        blockers,
        recentBusinesses,
        instrumentationStarted: productRows.length > 0,
      },
      planSelection: {
        reached: planReachedCount,
        freeClicked: freeClickedCount,
        growthClicked: growthClickedCount,
        growthCheckoutStarted: growthCheckoutCount,
        growthTrialStarted: growthTrialStartedCount,
        growthActivated: growthActivatedCount,
        growthPaidActive: entitlementRows.filter((row) => row.billing_status === "subscription_active").length,
      },
      trialValue: {
        trialStarts: trialCohort.length,
        trialing: trialing.length,
        cancellationMarked,
        withoutCancellation,
        price: currentPrice,
        monthlyPriceAud: currentPrice?.currency === "AUD" && currentPrice.interval === "month" && currentPrice.intervalCount === 1 ? currentPrice.amount / 100 : null,
        fullConversionMonthlyAud: currentPrice?.currency === "AUD" && currentPrice.interval === "month" && currentPrice.intervalCount === 1 ? trialing.length * currentPrice.amount / 100 : null,
        withoutCancellationMonthlyAud: currentPrice?.currency === "AUD" && currentPrice.interval === "month" && currentPrice.intervalCount === 1 ? withoutCancellation * currentPrice.amount / 100 : null,
      },
      dashboardBehavior: {
        totalClickers: new Set(dashboardActionRows.map((row) => normalizeEmail(row.actor_email)).filter(Boolean)).size,
        totalClicks: dashboardActionRows.length,
        actions: dashboardActions,
      },
      growthSummary: {
        businessSignups: businessProfiles.length,
        affiliateSignups: ((affiliateProfilesResult?.data || []) as Array<unknown>).length,
        offersPublished: (offersResult.data || []).filter((row: any) => (!fromIso || row.created_at >= fromIso) && row.created_at <= generatedAt).length,
        affiliateRequests: (affiliateRequestsResult.data || []).filter((row: any) => (!fromIso || row.created_at >= fromIso) && row.created_at <= generatedAt).length,
        liveCampaigns: ((liveCampaignsResult?.data || []) as Array<unknown>).length + (paidCampaignsResult.data || []).filter((row: any) => (!fromIso || row.created_at >= fromIso) && row.created_at <= generatedAt && row.meta_ad_id && row.meta_campaign_id).length,
        trackedRevenue: Number(revenueTotal.toFixed(2)),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[marketing-events][GET] unexpected error", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
