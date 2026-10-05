import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  BUSINESS_GROWTH_TRIAL_DAYS, createBusinessSubscriptionStripeClient,
  createServerSupabaseClient, getBusinessSubscriptionPriceId,
} from "../../../../../utils/businessSubscriptions";
import { canAccessMarketingDashboard } from "../../../../../utils/marketing/internalAccess";
import { buildStartTrial, sendStartTrial } from "../../../../../utils/marketing/startTrial";
import { NETTMARK_META_PIXEL_ID } from "../../../../../utils/marketing/metaConfig";
import Stripe from "stripe";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const { data, error } = await userSupabase.auth.getUser();
    const user = data?.user;
    if (error || !user?.email || !canAccessMarketingDashboard(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const code = typeof body.testEventCode === "string" ? body.testEventCode.trim() : "";
    const eventId = typeof body.stripeEventId === "string" ? body.stripeEventId : "";
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(code) || !/^evt_[A-Za-z0-9]+$/.test(eventId)) {
      return NextResponse.json({ error: "A Meta test-event code and Stripe subscription-created event ID are required" }, { status: 400 });
    }
    if (!process.env.META_CAPI_ACCESS_TOKEN) return NextResponse.json({ error: "Server CAPI configuration missing" }, { status: 503 });
    const stripe = createBusinessSubscriptionStripeClient();
    const event = await stripe.events.retrieve(eventId);
    if (event.type !== "customer.subscription.created") return NextResponse.json({ error: "Use the confirmed subscription-created event" }, { status: 400 });
    const subscription = event.data.object as Stripe.Subscription;
    const businessId = subscription.metadata.business_id;
    if (subscription.metadata.user_id !== user.id ||
        subscription.metadata.business_email?.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Use your own internal test business" }, { status: 403 });
    }
    const { data: entitlement, error: entitlementError } = await createServerSupabaseClient().from("business_entitlements")
      .select("stripe_subscription_id").eq("business_id", businessId).maybeSingle();
    if (entitlementError || entitlement?.stripe_subscription_id !== subscription.id) {
      return NextResponse.json({ error: "Nettmark has not confirmed this trial" }, { status: 409 });
    }
    const payload = buildStartTrial({
      subscription, eventLivemode: event.livemode, businessId, userId: user.id, email: user.email,
      priceId: getBusinessSubscriptionPriceId(), trialDays: BUSINESS_GROWTH_TRIAL_DAYS,
      allowInternalForTest: true,
    });
    if (!payload) return NextResponse.json({ error: "This event does not prove a recent, genuine Growth trial" }, { status: 400 });
    payload.event_id = "test_" + payload.event_id;
    const result = await sendStartTrial({
      payload, token: process.env.META_CAPI_ACCESS_TOKEN, pixelId: NETTMARK_META_PIXEL_ID, testEventCode: code,
    });
    return NextResponse.json({ ...result, eventId: payload.event_id }, { status: result.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ error: "Test event could not be verified or delivered" }, { status: 502 });
  }
}
