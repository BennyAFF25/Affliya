export function safeBusinessReturnTo(value: string | null) {
  const raw = String(value || "").trim();
  if (
    !raw ||
    raw.length > 500 ||
    !raw.startsWith("/business/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    Array.from(raw).some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  ) {
    return null;
  }
  const parsed = new URL(raw, "https://business-return.invalid");
  if (parsed.origin !== "https://business-return.invalid" || !parsed.pathname.startsWith("/business/")) return null;
  // Legacy notification links used ?proposal= on the listing page.
  // Go directly to the owner-scoped review after authentication.
  const [pathname, query] = raw.split("?", 2);
  if (pathname === "/business/my-business/ad-ideas" && query) {
    const proposalId = new URLSearchParams(query).get("proposal");
    if (proposalId && /^[0-9a-f-]{36}$/i.test(proposalId)) {
      return `/business/my-business/ad-ideas/${encodeURIComponent(proposalId)}`;
    }
  }
  return parsed.pathname + parsed.search + parsed.hash;
}

/** Carry a validated login destination through the existing plan/onboarding gates. */
export function businessContinuationDestination(destination: string, value: string | null) {
  const next = safeBusinessReturnTo(value);
  if (!next) return destination;
  if (destination.startsWith("/onboarding/for-business") || destination === "/business/choose-plan") {
    const url = new URL(destination, "https://business-return.invalid");
    url.searchParams.set("next", next);
    return url.pathname + url.search + url.hash;
  }
  return destination.startsWith("/business/my-business") ? next : destination;
}
