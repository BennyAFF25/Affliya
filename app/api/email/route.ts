import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { sendEmail, getEmailConfig } from "@/../lib/email/send";
import {
  affiliateWelcomeEmail,
  businessWelcomeEmail,
  adminNewUserEmail,
  adminNewOfferEmail,
  businessNewAffiliateRequestEmail,
  affiliateRequestDecisionEmail,
  adDecisionEmail,
} from "@/../lib/email/templates";

type EmailEvent =
  | { type: "affiliate_welcome" }
  | { type: "business_welcome" }
  | { type: "admin_new_user"; data: { userEmail: string; role: "affiliate" | "business" } }
  | { type: "admin_new_offer"; data: { businessEmail: string; offerTitle?: string; offerId?: string } }
  | { type: "business_new_affiliate_request"; data: { businessEmail: string; affiliateEmail: string; offerTitle?: string; notes?: string } }
  | { type: "affiliate_request_decision"; data: { affiliateEmail: string; offerTitle?: string; decision: "approved" | "rejected"; note?: string } }
  | { type: "ad_decision"; data: { affiliateEmail: string; offerTitle?: string; decision: "approved" | "rejected"; note?: string } };

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json()) as EmailEvent;

    // Optional kill switch
    if (process.env.EMAIL_DISABLED === "true") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const me = user.email.toLowerCase();
    const cfg = getEmailConfig();

    // helpers
    const sendAdmin = async (subject: string, html: string) => {
      if (!cfg.adminEmail) return;
      await sendEmail({ to: cfg.adminEmail, subject, html });
    };

    // -------------------------
    // Handle events
    // -------------------------
    if (body.type === "affiliate_welcome") {
      // Only allow sending to self (prevents spam)
      const { subject, html } = affiliateWelcomeEmail({ affiliateEmail: me });
      await sendEmail({ to: me, subject, html });

      // Admin alert
      if (cfg.adminEmail) {
        const a = adminNewUserEmail({ userEmail: me, role: "affiliate" });
        await sendAdmin(a.subject, a.html);
      }

      return NextResponse.json({ ok: true });
    }

    if (body.type === "business_welcome") {
      const { subject, html } = businessWelcomeEmail({ businessEmail: me });
      await sendEmail({ to: me, subject, html });

      if (cfg.adminEmail) {
        const a = adminNewUserEmail({ userEmail: me, role: "business" });
        await sendAdmin(a.subject, a.html);
      }

      return NextResponse.json({ ok: true });
    }

    if (body.type === "admin_new_user") {
      // Only allow self-report (new user can trigger admin notify)
      if (body.data.userEmail.toLowerCase() !== me) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
      if (!cfg.adminEmail) return NextResponse.json({ ok: true });

      const a = adminNewUserEmail(body.data);
      await sendAdmin(a.subject, a.html);
      return NextResponse.json({ ok: true });
    }

    if (body.type === "admin_new_offer") {
      // Only business that owns the offer should trigger this
      if (body.data.businessEmail.toLowerCase() !== me) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
      if (!cfg.adminEmail) return NextResponse.json({ ok: true });

      const a = adminNewOfferEmail(body.data);
      await sendAdmin(a.subject, a.html);
      return NextResponse.json({ ok: true });
    }

    if (body.type === "business_new_affiliate_request") {
      // Must be the business to trigger notify
      if (body.data.businessEmail.toLowerCase() !== me) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }

      const { subject, html } = businessNewAffiliateRequestEmail(body.data);
      await sendEmail({ to: body.data.businessEmail, subject, html });

      // Admin optional
      if (cfg.adminEmail) {
        await sendAdmin(
          `🧲 New affiliate request: ${body.data.affiliateEmail}`,
          `<p>Business: ${body.data.businessEmail}</p><p>Affiliate: ${body.data.affiliateEmail}</p>`
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (body.type === "affiliate_request_decision") {
      // Must be business user triggering this (the reviewer)
      // We can’t perfectly prove ownership without extra DB checks, but at least require logged-in user exists.
      const { subject, html } = affiliateRequestDecisionEmail(body.data);
      await sendEmail({ to: body.data.affiliateEmail, subject, html });

      if (cfg.adminEmail) {
        await sendAdmin(
          `📣 Affiliate request ${body.data.decision}: ${body.data.affiliateEmail}`,
          `<p>Decision: ${body.data.decision}</p><p>Offer: ${body.data.offerTitle || ""}</p>`
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (body.type === "ad_decision") {
      const { subject, html } = adDecisionEmail(body.data);
      await sendEmail({ to: body.data.affiliateEmail, subject, html });

      if (cfg.adminEmail) {
        await sendAdmin(
          `📣 Ad ${body.data.decision}: ${body.data.affiliateEmail}`,
          `<p>Decision: ${body.data.decision}</p><p>Offer: ${body.data.offerTitle || ""}</p>`
        );
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown event type" }, { status: 400 });
  } catch (err: any) {
    console.error("[❌ /api/email] error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}