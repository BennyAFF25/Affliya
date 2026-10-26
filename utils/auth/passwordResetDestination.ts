/** Navigation hint only; destination pages retain their existing access checks. */
export function passwordResetDestination(hasSession: boolean, profileRole?: unknown, metadataRole?: unknown) {
  const role = String(profileRole || metadataRole || '').trim().toLowerCase();
  if (role !== 'affiliate' && role !== 'business') return '/login?passwordUpdated=1';
  if (!hasSession) return `/login/${role}?reset=1&passwordUpdated=1`;
  return (role === 'affiliate' ? '/affiliate/dashboard' : '/business/my-business') + '?passwordUpdated=1';
}
