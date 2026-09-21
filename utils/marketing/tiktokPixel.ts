declare global {
  interface Window {
    ttq?: {
      identify?: (payload: Record<string, string>) => void;
      track?: (
        eventName: string,
        payload?: Record<string, unknown>,
        options?: { event_id?: string },
      ) => void;
    };
  }
}

async function sha256(value: string) {
  const normalized = value.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function createTikTokEventId(prefix: string) {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {}

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getTikTokClickId() {
  if (typeof window === 'undefined') return undefined;

  try {
    const current = new URLSearchParams(window.location.search).get('ttclid');
    if (current) {
      window.localStorage.setItem('nettmark.tiktokClickId', current);
      return current;
    }

    return window.localStorage.getItem('nettmark.tiktokClickId') || undefined;
  } catch {
    return undefined;
  }
}

function getTikTokBrowserId() {
  if (typeof document === 'undefined') return undefined;

  try {
    const match = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith('_ttp='));
    return match ? decodeURIComponent(match.slice('_ttp='.length)) : undefined;
  } catch {
    return undefined;
  }
}

export async function identifyTikTokUser(input: {
  email?: string | null;
  phoneNumber?: string | null;
  externalId?: string | null;
}) {
  if (typeof window === 'undefined' || !window.ttq?.identify) return;

  const payload: Record<string, string> = {};

  if (input.email) payload.email = await sha256(input.email);
  if (input.phoneNumber) payload.phone_number = await sha256(input.phoneNumber);
  if (input.externalId) payload.external_id = await sha256(input.externalId);

  if (Object.keys(payload).length > 0) {
    window.ttq.identify(payload);
  }
}

type TikTokTrackOptions = {
  eventId?: string;
  email?: string | null;
  externalId?: string | null;
  testEventCode?: string;
};

export function trackTikTokEvent(
  eventName: 'ViewContent' | 'ClickButton' | 'Lead' | 'Search',
  payload?: Record<string, unknown>,
  options?: TikTokTrackOptions,
) {
  if (typeof window === 'undefined') return null;

  const resolvedEventId =
    options?.eventId || createTikTokEventId(eventName.toLowerCase());

  if (window.ttq?.track) {
    window.ttq.track(eventName, payload, { event_id: resolvedEventId });
  }

  void fetch('/api/marketing/tiktok-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      eventId: resolvedEventId,
      properties: payload,
      pageUrl: window.location.href,
      referrer: document.referrer || undefined,
      email: options?.email || undefined,
      externalId: options?.externalId || undefined,
      ttclid: getTikTokClickId(),
      ttp: getTikTokBrowserId(),
      testEventCode: options?.testEventCode,
    }),
  }).catch(() => {
    // Best-effort tracking only; never block the user flow.
  });

  return resolvedEventId;
}
