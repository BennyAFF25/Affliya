const STORAGE_KEY = "nettmark.marketingAttribution";

const ATTR_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "msclkid",
  "ref",
  "source",
] as const;

type AttrKey = (typeof ATTR_KEYS)[number];

export type MarketingAttribution = Partial<Record<AttrKey, string>>;

function sanitizeValue(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 300) : null;
}

export function extractAttributionFromSearchParams(searchParams: URLSearchParams): MarketingAttribution {
  const attribution: MarketingAttribution = {};

  for (const key of ATTR_KEYS) {
    const value = sanitizeValue(searchParams.get(key));
    if (value) attribution[key] = value;
  }

  return attribution;
}

export function readStoredAttribution(): MarketingAttribution {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const attribution: MarketingAttribution = {};

    for (const key of ATTR_KEYS) {
      const value = sanitizeValue(typeof parsed?.[key] === "string" ? String(parsed[key]) : null);
      if (value) attribution[key] = value;
    }

    return attribution;
  } catch {
    return {};
  }
}

export function persistAttribution(attribution: MarketingAttribution) {
  if (typeof window === "undefined") return;

  const merged = {
    ...readStoredAttribution(),
    ...attribution,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
}

export function getAttributionFromWindow(): MarketingAttribution {
  if (typeof window === "undefined") return {};
  const current = extractAttributionFromSearchParams(new URLSearchParams(window.location.search));
  return {
    ...readStoredAttribution(),
    ...current,
  };
}

export function buildHrefWithAttribution(href: string, attribution: MarketingAttribution) {
  const hasWindow = typeof window !== "undefined";
  const url = new URL(href, hasWindow ? window.location.origin : "https://www.nettmark.com");

  for (const [key, value] of Object.entries(attribution)) {
    if (!value || url.searchParams.has(key)) continue;
    url.searchParams.set(key, value);
  }

  if (href.startsWith("http://") || href.startsWith("https://")) {
    return url.toString();
  }

  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
