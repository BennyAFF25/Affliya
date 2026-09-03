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

const ALLOWED_EVENT_TYPES = new Set(["page_view", "create_account_start", "business_demo_cta_click", "account_created"]);

type MetricCounts = {
  pageViews: number;
  createAccountStarts: number;
  businessDemoCtaClicks: number;
  completedSignups: number;
};

function emptyCounts(): MetricCounts {
  return {
    pageViews: 0,
    createAccountStarts: 0,
    businessDemoCtaClicks: 0,
    completedSignups: 0,
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

    const [eventsResult, revenueResult] = await Promise.all([
      fromIso ? eventsQuery.gte("created_at", fromIso) : eventsQuery,
      fromIso ? revenueQuery.gte("accrued_at", fromIso) : revenueQuery,
    ]);

    const profileQuery = (supabaseAdmin as any)
      .from("profiles")
      .select("role, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    const profileResult = fromIso ? await profileQuery.gte("created_at", fromIso) : await profileQuery;

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
          : row.event_type === "account_created"
            ? "completedSignups"
          : row.event_type === "business_demo_cta_click"
            ? "businessDemoCtaClicks"
            : "pageViews";

      if (eventKey !== "completedSignups") {
        totals[eventKey] += 1;
      }

      if (!byPage[row.page_path]) byPage[row.page_path] = emptyCounts();
      byPage[row.page_path][eventKey] += 1;

      if (eventKey !== "completedSignups") {
        const audienceKey = row.audience || "unknown";
        if (!byAudience[audienceKey]) byAudience[audienceKey] = emptyCounts();
        byAudience[audienceKey][eventKey] += 1;
      }

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

    const profileRows = ((profileResult?.data as Array<{
      role: string | null;
      created_at: string;
    }>) || []).filter((row) => row?.created_at);

    for (const row of profileRows) {
      totals.completedSignups += 1;

      const audienceKey = row.role || "unknown";
      if (!byAudience[audienceKey]) byAudience[audienceKey] = emptyCounts();
      byAudience[audienceKey].completedSignups += 1;
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
    });
  } catch (error) {
    console.error("[marketing-events][GET] unexpected error", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
