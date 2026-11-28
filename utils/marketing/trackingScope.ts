/** Growth Partner pages are noindex referral surfaces; they only use the designed Meta Lead event. */
export function isGrowthPartnerPath(pathname: string | null | undefined) {
  const path = String(pathname || '').toLowerCase();
  return path === '/growth-partners' || path.startsWith('/growth-partners/') || path.startsWith('/r/');
}

/** Third-party marketing trackers (Trybe, Reddit, TikTok, offer tracker) run on production deployments only. */
export function marketingTrackersAllowed(pathname: string | null | undefined, vercelEnv: string | undefined) {
  return vercelEnv === 'production' && Boolean(pathname) && !isGrowthPartnerPath(pathname);
}
