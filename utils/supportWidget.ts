/** Focused messaging/auth screens suppress support at every viewport. */
export function supportWidgetHiddenRoute(pathname: string | null | undefined, mobile = false) {
  const path = pathname || '';
  if (/^\/(?:login|create-account|signup|reset-password|auth)(?:\/|$)/.test(path)) return true;
  if (/^\/(?:affiliate|business)\/inbox(?:\/|$)/.test(path)) return true;
  if (!mobile) return false;
  // Onboarding footer, promotion/review actions, and demo sticky CTAs.
  return /^\/onboarding(?:\/|$)/.test(path) ||
    /^\/affiliate\/dashboard\/(?:promote|reviews)(?:\/|$)/.test(path) ||
    /^\/business\/(?:review-campaign|my-business\/(?:ad-ideas|post-ideas))(?:\/|$)/.test(path) ||
    /^\/lp\/(?:partner-demo|business-demo)(?:\/|$)/.test(path);
}
