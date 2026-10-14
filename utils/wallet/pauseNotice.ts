export type PauseNotice = { confirmed: boolean; walletLeft: number; needsFunds?: boolean };
export function pauseNoticeText(notice: PauseNotice | undefined) {
  if (!notice) return null;
  const left = `A$${notice.walletLeft.toFixed(2)}`;
  if (notice.confirmed && notice.needsFunds === false) return `Paused: wallet funds ran low. ${left} available now. Review and resume in Manage Campaigns; adding funds does not resume automatically.`;
  return notice.confirmed
    ? `Paused: wallet funds ran low (${left} available now). Add funds, then review and resume in Manage Campaigns. Adding funds does not resume automatically.`
    : `Paused: wallet funding is currently low (${left} available). Add funds before resuming. The original pause reason was not recorded.`;
}
export function confirmedFundingPause(ad: { billing_paused_at?: string | null }, audit: { reason_code?: string | null; created_at?: string | null } | undefined) {
  if (audit?.reason_code !== "LOW_FUNDS") return false;
  // Reject an older reason after any later pause/resume cycle.
  return !ad.billing_paused_at || Boolean(audit.created_at && Date.parse(audit.created_at) >= Date.parse(ad.billing_paused_at));
}
