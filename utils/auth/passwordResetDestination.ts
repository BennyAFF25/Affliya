export const PASSWORD_UPDATED_FLAG = 'nm_password_updated';

/**
 * Signed-in resets reuse the normal post-login router (/auth-redirect), which
 * applies the business plan gate and the affiliate first-brand gate.
 */
export function passwordResetDestination(hasSession: boolean, profileRole?: unknown, metadataRole?: unknown) {
  if (hasSession) return '/auth-redirect?passwordUpdated=1';
  const role = String(profileRole || metadataRole || '').trim().toLowerCase();
  if (role !== 'affiliate' && role !== 'business') return '/login?passwordUpdated=1';
  return `/login/${role}?reset=1&passwordUpdated=1`;
}

/** Show the note on the final landing page, not on redirect/reset screens. */
export function showPasswordUpdatedNoticeOn(pathname: string | null | undefined) {
  return !!pathname && !/^\/(?:auth-redirect|auth)(?:\/|$)/.test(pathname);
}
