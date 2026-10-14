type Schedule = { start_time?: string | null; end_time?: string | null; created_at?: string | null };
const DAY = 86400000;
export function defaultCampaignEnd(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() + 14);
  end.setHours(23, 59, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T23:59`;
}
/** Null start means approval-relative. Past explicit starts roll forward on approval,
 * preserving the proposed duration; no persisted proposal or live campaign is changed.
 * For a null start, end minus created_at stores the duration using existing columns.
 */
export function resolveCampaignSchedule(idea: Schedule, now = Date.now()) {
  const start = idea.start_time ? Date.parse(idea.start_time) : null;
  const end = idea.end_time ? Date.parse(idea.end_time) : null;
  const created = idea.created_at ? Date.parse(idea.created_at) : now;
  if (start !== null && !Number.isFinite(start) || end !== null && !Number.isFinite(end)) return idea;
  if (start !== null && start > now) return idea;
  const duration = end !== null ? end - (start ?? created) : 14 * DAY;
  // Leave invalid duration intact for the validators to reject.
  if (!Number.isFinite(duration) || duration <= 0) return idea;
  const launchStart = now + 120000;
  return { ...idea, start_time: new Date(launchStart).toISOString(), end_time: new Date(launchStart + duration).toISOString() };
}
