import { pauseNoticeText, type PauseNotice } from './pauseNotice';
type StatusRow = { status?: string | null; billing_state?: string | null; terminated_by_business_at?: string | null };
export function isBusinessStopped(ad: StatusRow) {
  return Boolean(ad.terminated_by_business_at) || String(ad.billing_state || '').toUpperCase() === 'TERMINATED_BY_BUSINESS';
}
export function campaignState(ad: StatusRow) {
  if (isBusinessStopped(ad)) return 'Stopped';
  const status = String(ad.status || '').toLowerCase();
  if (status === 'active' || status === 'live') return 'Active';
  if (status === 'paused') return 'Paused';
  if (status.includes('stop') || status === 'terminated') return 'Stopped';
  return status ? status[0].toUpperCase() + status.slice(1) : 'Unknown';
}
export function campaignStatusDetail(ad: StatusRow, notice?: PauseNotice, settling = 0, money = (amount: number) => `A$${amount.toFixed(2)}`) {
  const state = campaignState(ad);
  if (isBusinessStopped(ad)) return 'Stopped by business' + (settling > 0 ? ` · settling ${money(settling)}` : '');
  return pauseNoticeText(notice) || state + (settling > 0 && state !== 'Active' ? ` · settling ${money(settling)}` : '');
}
