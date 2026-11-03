export const PROPOSAL_REMINDER_START_AT = "2026-11-03T08:30:00Z";
export type ProposalReminderStage = "24h" | "72h";

export function selectProposalReminderStage(args: {
  createdAt: string; now: Date; status: string; businessViewedAt?: string | null;
  alreadySent: Set<ProposalReminderStage>;
}): ProposalReminderStage | null {
  const created = Date.parse(args.createdAt);
  if (args.status.toLowerCase() !== "pending" || args.businessViewedAt ||
    !Number.isFinite(created) || created < Date.parse(PROPOSAL_REMINDER_START_AT)) return null;
  const age = args.now.getTime() - created;
  if (age >= 72 * 3600000) return args.alreadySent.has("72h") ? null : "72h";
  if (age >= 24 * 3600000 && !args.alreadySent.has("24h")) return "24h";
  return null;
}
