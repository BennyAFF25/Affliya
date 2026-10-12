/**
 * Nettmark landing-page metrics, separate from paid-network click metrics.
 *
 * Prior to Oct 2026, tracker.js sent 'click' on every page load. Those legacy
 * events are landing visits, NOT verified ad clicks. Keep the old data intact.
 * In particular, never use these events for commission, Meta billing, or spend.
 */
export type VisitEvent = {
  event_type?: string | null;
  user_agent?: string | null;
};

const VISIT_EVENT_TYPES = new Set([
  "page_view", "page_viewed", "view", "landing_view", "click",
]);

export function isLikelyAutomatedVisit(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /(?:bot|crawler|spider|facebookexternalhit|meta-externalhit|meta-externalagent|facebot|preview|headlesschrome|google-inspectiontool|slackbot|discordbot|twitterbot|linkedinbot|whatsapp|telegrambot)/i.test(userAgent);
}

export function isTrackedLandingVisit(event: VisitEvent): boolean {
  return VISIT_EVENT_TYPES.has(String(event.event_type || "").toLowerCase()) &&
    !isLikelyAutomatedVisit(event.user_agent);
}
