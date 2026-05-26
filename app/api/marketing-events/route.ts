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

const ALLOWED_EVENT_TYPES = new Set(["page_view", "create_account_start"]);

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
    const daysParam = (url.searchParams.get("days") || "30").toLowerCase();
    const allTime = daysParam === "all";
    const parsedDays = Number(daysParam);
    const days = allTime ? null : Math.min(Math.max(Number.isFinite(parsedDays) ? parsedDays : 30, 1), 365);
    const from = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null;

    const eventsQuery = (supabaseAdmin as any)
      .from("marketing_site_events")
      .select("event_type, page_path, audience, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    const revenueQuery = (supabaseAdmin as any)
      .from("platform_fee_ledger")
      .select("amount, status, currency, accrued_at")
      .order("accrued_at", { ascending: false })
      .limit(5000);

    const [eventsResult, revenueResult] = await Promise.all([
      from ? eventsQuery.gte("created_at", from) : eventsQuery,
      from ? revenueQuery.gte("accrued_at", from) : revenueQuery,
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
      created_at: string;
    }>;

    const totals = {
      pageViews: 0,
      createAccountStarts: 0,
    };

    const byPage: Record<string, { pageViews: number; createAccountStarts: number }> = {};
    const byAudience: Record<string, { pageViews: number; createAccountStarts: number }> = {};
    const dailyMap: Record<string, { date: string; pageViews: number; createAccountStarts: number }> = {};

    for (const row of rows) {
      const eventKey = row.event_type === "create_account_start" ? "createAccountStarts" : "pageViews";
      totals[eventKey] += 1;

      if (!byPage[row.page_path]) {
        byPage[row.page_path] = { pageViews: 0, createAccountStarts: 0 };
      }
      byPage[row.page_path][eventKey] += 1;

      const audienceKey = row.audience || "unknown";
      if (!byAudience[audienceKey]) {
        byAudience[audienceKey] = { pageViews: 0, createAccountStarts: 0 };
      }
      byAudience[audienceKey][eventKey] += 1;

      const date = row.created_at.slice(0, 10);
      if (!dailyMap[date]) {
        dailyMap[date] = { date, pageViews: 0, createAccountStarts: 0 };
      }
      dailyMap[date][eventKey] += 1;
    }

    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    const revenueRows = ((revenueResult?.data as Array<{
      amount: number | string | null;
      status: string | null;
      currency: string | null;
      accrued_at: string;
    }>) || []).filter((row) => row?.accrued_at);

    const revenueByStatus: Record<string, number> = {};
    const revenueDailyMap: Record<string, number> = {};
    let revenueTotal = 0;

    for (const row of revenueRows) {
      const amount = Number(row.amount || 0);
      if (!Number.isFinite(amount)) continue;

      revenueTotal += amount;
      const statusKey = row.status || "unknown";
      revenueByStatus[statusKey] = (revenueByStatus[statusKey] || 0) + amount;

      const date = row.accrued_at.slice(0, 10);
      revenueDailyMap[date] = (revenueDailyMap[date] || 0) + amount;
    }

    const revenueDaily = Object.entries(revenueDailyMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      ok: true,
      days: days ?? "all",
      totals,
      byPage,
      byAudience,
      daily,
      recentCount: rows.length,
      revenue: {
        total: Number(revenueTotal.toFixed(2)),
        byStatus: Object.fromEntries(
          Object.entries(revenueByStatus).map(([key, value]) => [key, Number(value.toFixed(2))]),
        ),
        daily: revenueDaily.map((row) => ({ ...row, amount: Number(row.amount.toFixed(2)) })),
        count: revenueRows.length,
      },
    });
  } catch (error) {
    console.error("[marketing-events][GET] unexpected error", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
