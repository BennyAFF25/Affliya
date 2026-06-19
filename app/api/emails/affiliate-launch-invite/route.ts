import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "https://www.nettmark.com"
  ).replace(/\/$/, "");
}

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function getRequestUser(req: Request) {
  const cookieSupabase = createRouteHandlerClient({ cookies });
  const cookieResult = await cookieSupabase.auth.getUser();

  if (cookieResult.data.user?.email) {
    return {
      user: cookieResult.data.user,
      error: null,
    };
  }

  const token = getBearerToken(req);
  const supabaseUrl = getSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !supabaseUrl || !anonKey) {
    return {
      user: null,
      error: cookieResult.error || new Error("auth_required"),
    };
  }

  const bearerSupabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const bearerResult = await bearerSupabase.auth.getUser(token);
  return {
    user: bearerResult.data.user,
    error: bearerResult.error,
  };
}

async function createLaunchInboxInvite(args: {
  businessEmail: string;
  affiliateEmail: string;
  offerId: string;
  offerTitle: string;
  requestId: string | null;
}) {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[affiliate-launch-invite] inbox insert skipped: missing service role config");
    return null;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabaseAdmin
    .from("inbox_messages")
    .insert([
      {
        sender_email: args.businessEmail,
        sender_role: "business",
        sender_name: null,
        recipient_email: args.affiliateEmail,
        recipient_role: "affiliate",
        message_type: "launch_invite",
        title: `You're invited to launch ${args.offerTitle}`,
        body: "Your promotion request was approved. Open the offer to create a paid ad or organic campaign and start promoting.",
        preview: `Launch your first campaign for ${args.offerTitle}.`,
        offer_id: args.offerId,
        campaign_id: null,
        affiliate_request_id: args.requestId,
        cta_label: "Launch Campaign",
        cta_url: `/affiliate/dashboard/promote/${args.offerId}`,
        metadata: { source: "affiliate_requests" },
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("[affiliate-launch-invite] inbox insert failed", error);
    return null;
  }

  return data?.id || null;
}

export async function POST(req: Request) {
  const { user, error: userError } = await getRequestUser(req);

  if (userError || !user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const affiliateEmail = normalizeEmail(body?.affiliateEmail || body?.to);
  const businessEmail = normalizeEmail(body?.businessEmail);
  const offerId = String(body?.offerId || "").trim();
  const offerTitle = String(body?.offerTitle || "this offer").trim();
  const requestId = body?.requestId ? String(body.requestId) : null;

  if (!affiliateEmail || !businessEmail || !offerId) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 },
    );
  }

  if (businessEmail !== user.email) {
    return NextResponse.json({ error: "sender_mismatch" }, { status: 403 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "missing_resend_api_key" },
      { status: 500 },
    );
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    return NextResponse.json(
      { error: "missing_resend_from_email" },
      { status: 500 },
    );
  }

  const appUrl = getAppUrl();
  const launchUrl = `${appUrl}/affiliate/dashboard/promote/${encodeURIComponent(
    offerId,
  )}`;
  const fromName = process.env.RESEND_FROM_NAME || "Nettmark";
  const subject = `You're invited to promote ${offerTitle}`;

  const html = renderNettmarkEmail({
    previewText: `Your request was approved. Launch a campaign for ${offerTitle} in Nettmark.`,
    badge: { text: "Launch invite", tone: "success" },
    heading: `You're invited to promote ${offerTitle}`,
    body:
      "Good news — the business has approved your promotion request and invited you to launch. Open the offer in Nettmark to create a paid ad or organic campaign and start promoting.",
    rows: [{ label: "Offer", value: offerTitle }],
    cta: { label: "Launch campaign", href: launchUrl },
    footerNote:
      "If you are not logged in, Nettmark will take you to the affiliate login page first and then return you to this launch page.",
  });

  const inboxMessageId = await createLaunchInboxInvite({
    businessEmail,
    affiliateEmail,
    offerId,
    offerTitle,
    requestId,
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [affiliateEmail],
    subject,
    html,
  });

  if (error) {
    console.error("[affiliate-launch-invite] send failed", error);
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    id: (data as { id?: string } | null)?.id || null,
    inboxMessageId,
  });
}
