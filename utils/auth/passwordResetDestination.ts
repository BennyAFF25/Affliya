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

const safeInternal = (value: string | null) =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[\u0000-\u0020\u007f]/.test(value) ? value.slice(0, 500) : null;

/** /login?role=business&next=/x -> /login/business?returnTo=/x (affiliate login uses ?next=). */
export function roleLoginRedirect(search: string) {
  const params = new URLSearchParams(search);
  const role = params.get('role');
  if (role !== 'business' && role !== 'affiliate') return null;
  const next = safeInternal(params.get('next') || params.get('returnTo'));
  const out = new URLSearchParams();
  if (next) out.set(role === 'business' ? 'returnTo' : 'next', next);
  for (const key of ['reset', 'passwordUpdated']) if (params.get(key)) out.set(key, params.get(key)!);
  const query = out.toString();
  return `/login/${role}${query ? `?${query}` : ''}`;
}
