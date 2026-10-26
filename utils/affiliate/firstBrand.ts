/** Login-only decision. Unknown/failed reads must never trap an existing affiliate. */
export function firstBrandDestination(next: string | null, hasBrandActivity: boolean | null) {
  if (next && next.split(/[?#]/)[0] !== '/affiliate/dashboard') return next;
  return hasBrandActivity === false ? '/onboarding/for-partners' : next || '/affiliate/dashboard';
}
