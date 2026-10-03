import { safeInternalReturnTo } from "../affiliate/onboarding";

function usableReturn(value: string | null) {
  const safe = safeInternalReturnTo(value);
  // Avoid sending a reader straight back to another policy page.
  return safe && !safe.split(/[?#]/)[0].startsWith("/legal/") ? safe : null;
}

export function policyReturnDestination(explicit: string | null, referrer: string, origin: string) {
  const requested = usableReturn(explicit);
  if (requested) return requested;
  try {
    const previous = new URL(referrer);
    if (previous.origin === origin) {
      const returnTo = usableReturn(previous.pathname + previous.search + previous.hash);
      if (returnTo) return returnTo;
    }
  } catch { /* Direct policy visits can have no referrer. */ }
  return "/";
}
