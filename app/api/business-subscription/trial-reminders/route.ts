import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Trial reminders are new-signup-only and never change billing, subscriptions,
// payouts, approvals or campaign state. Not a manually callable public endpoint.
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const actual = req.headers.get("authorization") || "";
  const expected = secret ? "Bearer " + secret : "";
  return expected.length > 0 &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

type ReminderDay = 3 | 10 | 12;

function milestone(ageDays: number): ReminderDay | null {
  if (ageDays >= 12 && ageDays < 13) return 12;
  if (ageDays >= 10 && ageDays < 11) return 10;
  if (ageDays >= 3 && ageDays < 4) return 3;
  return null;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Email sending is not configured" }, { status: 503 });
  }

  const admin = createServerSupabaseClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 13 * 86400000).toISOString();
  const { data: trials, error } = await admin.from("business_entitlements")
    .select("business_id,business_email,billing_status,growth_trial_started_at,subscription_current_period_end")
    .eq("billing_status", "subscription_trialing")
    .gte("growth_trial_started_at", cutoff)
    .order("growth_trial_started_at", { ascending: true }).limit(400);
  if (error) return NextResponse.json({ error: "Trial status unavailable" }, { status: 503 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = `${process.env.RESEND_FROM_NAME || "Nettmark"} <${process.env.RESEND_FROM_EMAIL}>`;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nettmark.com").replace(/\/$/, "");
  let sent = 0, skipped = 0, failed = 0;

  for (const trial of trials || []) {
    const businessId = String(trial.business_id || "");
    const address = String(trial.business_email || "").trim();
    if (!businessId || !address || !trial.growth_trial_started_at) { skipped++; continue; }
    const ageDays = (now.getTime() - Date.parse(trial.growth_trial_started_at)) / 86400000;
    const day = milestone(ageDays);
    if (!day) { skipped++; continue; }
    const trialEnd = trial.subscription_current_period_end;
    if (!trialEnd || Date.parse(trialEnd) <= now.getTime()) { skipped++; continue; }

    // Only the explicit new-business plan-first signup cohort receives
    // these new lifecycle emails. Earlier users remain unaffected.
    const { data: identity, error: identityError } = await admin.auth.admin.getUserById(businessId);
    if (identityError || identity?.user?.user_metadata?.business_plan_first_v2 !== true) { skipped++; continue; }

    const { count: pending, error: proposalsError } = await admin.from("ad_ideas")
      .select("id", { count: "exact", head: true })
      .ilike("business_email", address).eq("status", "pending");
    if (proposalsError) { failed++; continue; }
    if (day === 3 && (pending || 0) > 0) { skipped++; continue; }
    if (day === 10 && (pending || 0) === 0) { skipped++; continue; }

    const endDate = new Date(trialEnd).toLocaleDateString("en-AU", {
      day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Adelaide",
    });
    const subject = day === 3 ? "Make your Growth offer more attractive to affiliates"
      : day === 10 ? "You have a paid campaign proposal waiting"
      : "Your Growth trial ends soon — review your billing";
    const body = day === 3
      ? "A strong commission, clear creative assets and a working landing page help affiliates decide to promote your business. Review your offer and make it easy for partners to pitch an ad."
      : day === 10
        ? `An affiliate wants to fund ads for you. You have a paid campaign proposal waiting for approval. Your Growth trial is scheduled to end on ${endDate}. Review the proposal before it ends.`
        : `Your 14-day Growth trial is scheduled to end on ${endDate}. Growth is A$49/month after your trial unless you cancel. You can review your subscription and cancel through Stripe from Nettmark Business Settings before renewal.`;
    const url = day === 3 ? site + "/business/my-business"
      : day === 10 ? site + "/business/my-business/ad-ideas"
      : site + "/business/settings";

    // Resend dedupes within 24h; the durable product_events record prevents
    // repeat emails after that period if scheduled jobs are retried.
    const eventType = "growth_trial_reminder_day_" + day;
    const { data: existing, error: existingError } = await admin.from("product_events")
      .select("id").eq("actor_email", address).eq("event_type", eventType).limit(1).maybeSingle();
    if (existingError) { failed++; continue; }
    if (existing) { skipped++; continue; }

    try {
      const { error: sendError } = await resend.emails.send({
        from, to: [address], subject,
        html: renderNettmarkEmail({
          previewText: body,
          badge: { text: "Growth trial", tone: "info" },
          heading: subject, body,
          cta: { href: url, label: day === 12 ? "Manage or cancel Growth" : day === 10 ? "Review paid proposals" : "Improve your offer" },
          footerNote: "Card-required Growth trial: 14 days free, then A$49/month unless cancelled. This reminder does not change your plan.",
        }),
      }, { idempotencyKey: `growth-trial-${day}/${businessId}` });
      if (sendError) { failed++; continue; }
      const { error: logError } = await admin.from("product_events").insert({
        event_type: eventType, actor_email: address, actor_role: "business",
        meta: { day, trial_ends_at: trialEnd, source: "scheduled_growth_trial_lifecycle" },
      });
      if (logError) console.warn("[growth-trial-reminders] sent but audit failed", { day, businessId });
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: failed === 0, sent, skipped, failed }, {
    status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" },
  });
}
