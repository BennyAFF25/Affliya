import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendFounderNotification } from "./sendFounderNotification";
import { renderNettmarkEmail } from "./renderNettmarkEmail";

export function resolveProposalFromAddress(env: NodeJS.ProcessEnv): string | null {
  const email = env.RESEND_FROM_EMAIL ||
    (env.VERCEL_ENV === "production" || env.NODE_ENV === "production" ? null : "onboarding@resend.dev");
  return email ? `${env.RESEND_FROM_NAME || "Nettmark"} <${email}>` : null;
}

export async function sendProposalEmail(admin: SupabaseClient, args: {
  to: string; subject: string; html: string; idempotencyKey: string;
  proposalId: string; kind: "organic" | "paid"; stage: string;
}): Promise<{ ok: boolean; error?: string }> {
  let reason: string;
  try {
    const from = resolveProposalFromAddress(process.env);
    if (!process.env.RESEND_API_KEY) reason = "missing_resend_api_key";
    else if (!from) reason = "missing_resend_from_email";
    else {
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from, to: [args.to], subject: args.subject, html: args.html,
      }, { idempotencyKey: args.idempotencyKey });
      if (!error) return { ok: true };
      // Do not log provider messages: they may contain request details.
      reason = "resend_rejected_email";
    }
  } catch { reason = "email_transport_failed"; }

  const context = { proposal_id: args.proposalId, kind: args.kind, stage: args.stage, reason };
  console.error("[proposal-email] delivery failed", context);
  try {
    const { error } = await admin.from("product_events").insert({
      event_type: "proposal_email_failed", actor_role: "system", actor_email: args.to, meta: context,
    });
    if (error) console.error("[proposal-email] failure audit unavailable", context);
  } catch { console.error("[proposal-email] failure audit unavailable", context); }
  if (process.env.ADMIN_NOTIFY_EMAIL) {
    try {
      const result = await sendFounderNotification({
        subject: "Proposal email failed",
        html: renderNettmarkEmail({ heading: "Proposal email failed", body: reason,
          rows: [{ label: "Proposal", value: args.proposalId }, { label: "Kind", value: args.kind },
            { label: "Stage", value: args.stage }], recipientNote: "Internal Nettmark notification." }),
      }, `proposal-email-failed/${args.kind}/${args.proposalId}/${args.stage}`);
      if (result?.error) console.error("[proposal-email] founder alert failed", context);
    } catch { console.error("[proposal-email] founder alert failed", context); }
  }
  return { ok: false, error: reason };
}
