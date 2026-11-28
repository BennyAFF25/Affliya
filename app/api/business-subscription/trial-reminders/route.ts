import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import type Stripe from "stripe";
import { createBusinessSubscriptionStripeClient, createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";
import { selectGrowthTrialReminder, selectTrialBillingReminder, shouldAlertFounder, trialBillingReminderEmail } from "../../../../utils/growthTrialLifecycle";
import { sendFounderNotification } from "../../../../utils/email/sendFounderNotification";
import { STRIPE_GROWTH_BILLING_LOGIN_URL, growthBillingPortalUrl } from "../../../../utils/billingLinks";
import { formatStripeAmount, stripeDate } from "../../../../utils/billingNotifications";
import { growthEmailAllowed } from "../../../../utils/growthPartners/email";
import { excludedTrialEmail } from "../../../../utils/marketing/startTrial";

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

// Runs hourly: 24h milestone windows, durable events and Resend idempotency
// keys make repeat cron runs safe while reducing reminder/alert latency.
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Email sending is not configured" }, { status: 503 });
  }

  const admin = createServerSupabaseClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 13 * 86400000).toISOString();
  // Billing reminders v2 (E3 2-day for every cohort, optional E2 7-day), based on
  // the trial end rather than the trial age. Both flags default off.
  const billingV2 = process.env.TRIAL_BILLING_REMINDERS_V2_ENABLED === "true";
  const day7 = process.env.NETTMARK_DAY7_TRIAL_REMINDER === "true";
  const billingPath = billingV2 || day7;
  let trialQuery = admin.from("business_entitlements")
    .select(billingPath
      ? "business_id,business_email,billing_status,growth_trial_started_at,subscription_current_period_end,stripe_subscription_id"
      : "business_id,business_email,billing_status,growth_trial_started_at,subscription_current_period_end")
    .eq("billing_provider", "stripe")
    .eq("billing_status", "subscription_trialing");
  trialQuery = billingPath
    ? trialQuery.or(`growth_trial_started_at.gte."${cutoff}",subscription_current_period_end.gt."${now.toISOString()}"`)
    : trialQuery.gte("growth_trial_started_at", cutoff);
  const { data: trialRows, error } = await trialQuery
    .order("growth_trial_started_at", { ascending: true }).limit(400);
  const trials = (trialRows || []) as unknown as Array<{ business_id: string | null; business_email: string | null; growth_trial_started_at: string | null; subscription_current_period_end: string | null; stripe_subscription_id?: string | null }>;
  if (error) return NextResponse.json({ error: "Trial status unavailable" }, { status: 503 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = `${process.env.RESEND_FROM_NAME || "Nettmark"} <${process.env.RESEND_FROM_EMAIL}>`;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nettmark.com").replace(/\/$/, "");
  let sent = 0, skipped = 0, failed = 0;

  let stripe: Stripe | null = null;
  const portal = growthBillingPortalUrl();
  const production = process.env.VERCEL_ENV === "production";

  for (const trial of trials || []) {
    const businessId = String(trial.business_id || "");
    const address = String(trial.business_email || "").trim();
    if (billingPath && businessId && address) {
      const outcome = await sendTrialBillingReminder({ businessId, address, trialEnd: trial.subscription_current_period_end, subscriptionId: trial.stripe_subscription_id || null });
      if (outcome === "sent") sent++; else if (outcome === "failed") failed++;
    }
    if (!businessId || !address || !trial.growth_trial_started_at) { skipped++; continue; }
    const ageDays = (now.getTime() - Date.parse(trial.growth_trial_started_at)) / 86400000;
    const { count: offerCount, error: offersError } = await admin.from("offers")
      .select("id", { count: "exact", head: true }).ilike("business_email", address);
    if (offersError || offerCount === null) { failed++; continue; }

    // Internal follow-up includes all queried trial businesses, regardless of cohort.
    // Keep failures isolated so brand reminders can still be delivered.
    if (process.env.ADMIN_NOTIFY_EMAIL && shouldAlertFounder(ageDays, offerCount)) {
      try {
        const { data: alerted, error: alertCheckError } = await admin.from("product_events")
          .select("id").eq("event_type", "founder_trial_no_offer_alert")
          .eq("meta->>business_id", businessId).limit(1).maybeSingle();
        if (alertCheckError) { failed++; }
        else if (!alerted) {
          const result = await sendFounderNotification({
            subject: "Growth trial started without an offer",
            html: renderNettmarkEmail({
              heading: "Trial business has no offer", badge: { text: "Founder alert", tone: "info" },
              body: "This business started a Growth trial at least two hours ago and has not created an offer.",
              rows: [
                { label: "Business email", value: address },
                { label: "Trial started (Australia/Adelaide)", value: new Date(trial.growth_trial_started_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" }) },
              ],
              cta: { label: "Open Nettmark", href: "https://www.nettmark.com" },
              recipientNote: "Internal Nettmark notification.",
            }),
          }, `founder-trial-no-offer/${businessId}`);
          if (!result || result.error) { failed++; }
          else {
            const { error: alertLogError } = await admin.from("product_events").insert({
              event_type: "founder_trial_no_offer_alert", actor_email: address, actor_role: "business",
              meta: { business_id: businessId, trial_started_at: trial.growth_trial_started_at, source: "scheduled_growth_trial_lifecycle" },
            });
            if (alertLogError) { failed++; console.warn("[growth-trial-reminders] founder alert audit failed", { businessId }); }
            sent++;
          }
        }
      } catch { failed++; }
    }

    const reminder = selectGrowthTrialReminder(ageDays, offerCount, { includeDay12: !billingV2 });
    if (!reminder) { skipped++; continue; }
    const { day, noOffer, variant, eventType, dedupeEventTypes } = reminder;
    const trialEnd = trial.subscription_current_period_end;
    if (!trialEnd || Date.parse(trialEnd) <= now.getTime()) { skipped++; continue; }

    // Only the explicit new-business plan-first signup cohort receives
    // these new lifecycle emails. Earlier users remain unaffected.
    const { data: identity, error: identityError } = await admin.auth.admin.getUserById(businessId);
    if (identityError || identity?.user?.user_metadata?.business_plan_first_v2 !== true) { skipped++; continue; }

    if ((day === 3 && !noOffer) || day === 10) {
      const { count: pending, error: proposalsError } = await admin.from("ad_ideas")
        .select("id", { count: "exact", head: true })
        .ilike("business_email", address).eq("status", "pending");
      if (proposalsError) { failed++; continue; }
      if (day === 3 && (pending || 0) > 0) { skipped++; continue; }
      if (day === 10 && (pending || 0) === 0) { skipped++; continue; }
    }

    const endDate = new Date(trialEnd).toLocaleDateString("en-AU", {
      day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Adelaide",
    });
    const subject = noOffer
      ? day === 1 ? "Your offer isn't live yet — finish it in 2 minutes" : "Affiliates can't find you until your offer is live"
      : day === 3 ? "Make your Growth offer more attractive to affiliates"
      : day === 10 ? "You have a paid campaign proposal waiting"
      : "Your Growth trial ends soon — review your billing";
    const body = noOffer
      ? "You haven't created an offer yet. Finish your offer so affiliates can discover your business and see how they can promote it."
      : day === 3
      ? "A strong commission, clear creative assets and a working landing page help affiliates decide to promote your business. Review your offer and make it easy for partners to pitch an ad."
      : day === 10
        ? `An affiliate wants to fund ads for you. You have a paid campaign proposal waiting for approval. Your Growth trial is scheduled to end on ${endDate}. Review the proposal before it ends.`
        : `Your 14-day Growth trial is scheduled to end on ${endDate}. Growth is A$49/month after your trial unless you cancel. You can review your payment method or cancel securely in Stripe using your billing email, even if you cannot sign in to Nettmark.`;
    const url = day === 12 ? STRIPE_GROWTH_BILLING_LOGIN_URL : noOffer ? site + "/onboarding/for-business"
      : day === 3 ? site + "/business/my-business"
      : site + "/business/my-business/ad-ideas";

    // Resend dedupes within 24h; the durable product_events record prevents
    // repeat emails after that period if scheduled jobs are retried.
    const { data: existing, error: existingError } = await admin.from("product_events")
      .select("id").eq("actor_email", address).in("event_type", dedupeEventTypes).limit(1).maybeSingle();
    if (existingError) { failed++; continue; }
    if (existing) { skipped++; continue; }

    try {
      const { error: sendError } = await resend.emails.send({
        from, to: [address], subject,
        html: renderNettmarkEmail({
          previewText: body,
          badge: { text: "Growth trial", tone: "info" },
          heading: subject, body,
          cta: { href: url, label: noOffer ? "Finish my offer" : day === 12 ? "Manage billing or cancel trial" : day === 10 ? "Review paid proposals" : "Improve your offer" },
          // Customers can always reach secure billing without logging back
          // into Nettmark; early-trial messages keep offer activation primary.
          secondaryCta: day === 12 ? undefined : { href: STRIPE_GROWTH_BILLING_LOGIN_URL, label: "Manage billing or cancel trial" },
          footerNote: "Card-required Growth trial: 14 days free, then A$49/month unless cancelled. This reminder does not change your plan.",
        }),
      }, { idempotencyKey: `growth-trial-${variant}/${businessId}` });
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

  /** E3 / E2 for any trialing business; Stripe is rechecked so cancelled trials get nothing. */
  async function sendTrialBillingReminder(params: { businessId: string; address: string; trialEnd: string | null; subscriptionId: string | null }): Promise<"sent" | "skipped" | "failed"> {
    if (!params.trialEnd || !params.subscriptionId) return "skipped";
    const reminder = selectTrialBillingReminder((Date.parse(params.trialEnd) - now.getTime()) / 3600000, { e3: billingV2, e2: day7 });
    if (!reminder) return "skipped";
    if ((production && excludedTrialEmail(params.address)) || !growthEmailAllowed(params.address)) return "skipped";
    try {
      const { data: existing, error: existingError } = await admin.from("product_events")
        .select("id").eq("actor_email", params.address).in("event_type", [reminder.eventType]).limit(1).maybeSingle();
      if (existingError) return "failed";
      if (existing) return "skipped";
      stripe = stripe || createBusinessSubscriptionStripeClient();
      const sub = await stripe.subscriptions.retrieve(params.subscriptionId, { expand: ["default_payment_method"] });
      if (sub.status !== "trialing" || sub.cancel_at_period_end || sub.cancel_at || !sub.trial_end) return "skipped";
      const item = sub.items?.data?.[0];
      const unit = item?.price?.unit_amount;
      if (unit == null) return "failed";
      const pm = sub.default_payment_method;
      const last4 = pm && typeof pm === "object" ? pm.card?.last4 || null : null;
      const trialEndLabel = stripeDate(sub.trial_end);
      const { subject, content } = trialBillingReminderEmail(reminder.stage, {
        trialEnd: trialEndLabel, amount: formatStripeAmount(unit * (item?.quantity || 1), item?.price?.currency || "aud"), last4, portal,
      });
      const { error: sendError } = await resend.emails.send({
        from, to: [params.address], replyTo: "contact@nettmark.com", subject, html: renderNettmarkEmail(content),
      }, { idempotencyKey: reminder.idempotencyKey(params.businessId) });
      if (sendError) return "failed";
      const { error: logError } = await admin.from("product_events").insert({
        event_type: reminder.eventType, actor_email: params.address, actor_role: "business",
        meta: { business_id: params.businessId, stage: reminder.stage, trial_ends_at: new Date(sub.trial_end * 1000).toISOString(), source: "scheduled_growth_trial_billing_reminder" },
      });
      if (logError) console.warn("[growth-trial-reminders] billing reminder sent but audit failed", { stage: reminder.stage, businessId: params.businessId });
      return "sent";
    } catch {
      return "failed";
    }
  }
}
