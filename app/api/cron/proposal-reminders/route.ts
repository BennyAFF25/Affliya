import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";
import { sendProposalEmail } from "../../../../utils/email/sendProposalEmail";
import { getAffiliateUsername } from "../../../../utils/profileIdentity";
import { PROPOSAL_REMINDER_START_AT, selectProposalReminderStage, type ProposalReminderStage } from "../../../../utils/proposalReminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const actual = req.headers.get("authorization") || "";
  const expected = secret ? "Bearer " + secret : "";
  return expected.length > 0 &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

type Proposal = {
  id: string; offer_id: string; business_email: string; affiliate_email: string;
  status: string; business_viewed_at: string | null; created_at: string;
  platform?: string; caption?: string; image_url?: string;
};

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const admin = createServerSupabaseClient();
  const now = new Date();
  let sent = 0, skipped = 0, failed = 0;
  const wouldSend: { proposalId: string; kind: string; stage: ProposalReminderStage; reviewPath: string }[] = [];

  for (const kind of ["organic", "paid"] as const) {
    const { data: proposals, error } = await admin.from(kind === "organic" ? "organic_posts" : "ad_ideas")
      .select(kind === "organic"
        ? "id,offer_id,business_email,affiliate_email,status,business_viewed_at,created_at,platform,caption,image_url"
        : "id,offer_id,business_email,affiliate_email,status,business_viewed_at,created_at")
      .ilike("status", "pending").is("business_viewed_at", null)
      .gte("created_at", PROPOSAL_REMINDER_START_AT)
      .lte("created_at", new Date(now.getTime() - 24 * 3600000).toISOString())
      .gte("created_at", new Date(now.getTime() - 8 * 86400000).toISOString())
      .order("created_at", { ascending: true }).limit(300).returns<Proposal[]>();
    if (error) { failed++; continue; }
    for (const proposal of proposals || []) {
      try {
        const { data: events, error: eventError } = await admin.from("product_events")
          .select("stage:meta->>stage").eq("event_type", "proposal_reminder_sent")
          .eq("meta->>proposal_id", proposal.id);
        if (eventError) { failed++; continue; }
        const alreadySent = new Set<ProposalReminderStage>();
        for (const event of events || []) {
          if (event.stage === "24h" || event.stage === "72h") alreadySent.add(event.stage);
        }
        const stage = selectProposalReminderStage({ createdAt: proposal.created_at, now,
          status: proposal.status, businessViewedAt: proposal.business_viewed_at, alreadySent });
        if (!stage) { skipped++; continue; }
        const { data: offer, error: offerError } = await admin.from("offers")
          .select("id,title,business_email").eq("id", proposal.offer_id).maybeSingle();
        const to = String(proposal.business_email || "").trim().toLowerCase();
        if (offerError || !offer || !to || to !== String(offer.business_email || "").trim().toLowerCase()) {
          failed++; continue;
        }
        const reviewPath = `/business/my-business/${kind === "organic" ? "post-ideas" : "ad-ideas"}?proposal=${encodeURIComponent(proposal.id)}`;
        if (dryRun) { wouldSend.push({ proposalId: proposal.id, kind, stage, reviewPath }); continue; }
        const title = String(offer.title || "your offer");
        const affiliate = await getAffiliateUsername(admin, { email: proposal.affiliate_email });
        const subject = stage === "72h" ? `Still waiting: an affiliate proposal for ${title}`
          : "Reminder: an affiliate is waiting on your review";
        const result = await sendProposalEmail(admin, {
          to, subject, proposalId: proposal.id, kind, stage,
          idempotencyKey: `proposal-reminder/${kind}/${proposal.id}/${stage}`,
          html: renderNettmarkEmail({
            badge: { text: kind === "organic" ? "Organic proposal" : "Paid proposal" },
            heading: subject,
            body: `${affiliate} is waiting for you to review a proposal for ${title}. Nothing ${kind === "organic" ? "is posted" : "launches"} until you approve it.`,
            image: kind === "organic" && proposal.image_url ? { src: proposal.image_url, alt: `Post for ${title}` } : undefined,
            rows: [{ label: "Affiliate", value: affiliate },
              ...(kind === "organic" ? [
                { label: "Platform", value: String(proposal.platform || "Social media") },
                { label: "Caption", value: String(proposal.caption || "").slice(0, 400) },
              ] : [])],
            cta: { label: kind === "organic" ? "Review post" : "Review campaign", href: `https://www.nettmark.com${reviewPath}` },
          }),
        });
        if (!result.ok) { failed++; continue; }
        const { error: auditError } = await admin.from("product_events").insert({
          event_type: "proposal_reminder_sent", actor_email: to, actor_role: "system", offer_id: proposal.offer_id,
          meta: { proposal_id: proposal.id, kind, stage },
        });
        if (auditError) {
          // Stop the batch: without durable dedupe, further delivery is unsafe.
          console.error("[proposal-reminders] sent but audit failed", { proposalId: proposal.id, kind, stage });
          return NextResponse.json({ sent: sent + 1, skipped, failed: failed + 1, error: "Reminder audit unavailable" }, { status: 503 });
        }
        sent++;
        const notification = { user_email: to, title: "Proposal waiting for review",
          body: "An affiliate proposal is waiting for your review.", link_url: reviewPath };
        const { data: existing, error: lookupError } = await admin.from("notifications").select("id")
          .eq("user_email", to).eq("link_url", reviewPath).eq("title", notification.title).limit(1);
        if (lookupError) { failed++; continue; }
        if (!existing?.length) {
          const { error: insertError } = await admin.from("notifications").insert([notification]);
          if (insertError) failed++;
        }
      } catch {
        failed++;
        console.error("[proposal-reminders] processing failed", { proposalId: proposal.id, kind });
      }
    }
  }
  return NextResponse.json({ sent, skipped, failed, ...(dryRun ? { wouldSend } : {}) }, {
    status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" },
  });
}
