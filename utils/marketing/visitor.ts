const VISITOR_KEY = "nettmark.marketingVisitor.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Analytics identity only. Never use this value for access or commercial attribution. */
export function marketingVisitorId(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}

export function getMarketingVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = marketingVisitorId(window.localStorage.getItem(VISITOR_KEY));
    if (stored) return stored;
    const id = window.crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    // Storage-blocked visitors remain unlinked rather than receiving changing IDs.
    return null;
  }
}
