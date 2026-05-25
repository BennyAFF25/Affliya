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
    const days = Math.min(Math.max(Number(url.searchParams.get("days") || "30"), 1), 90);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await (supabaseAdmin as any)
      .from("marketing_site_events")
      .select("event_type, page_path, audience, created_at")
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(5000);

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

    return NextResponse.json({
      ok: true,
      days,
      totals,
      byPage,
      byAudience,
      daily,
      recentCount: rows.length,
    });
  } catch (error) {
    console.error("[marketing-events][GET] unexpected error", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
