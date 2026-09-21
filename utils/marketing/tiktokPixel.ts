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

export function trackTikTokEvent(
  eventName: 'ViewContent' | 'ClickButton' | 'Lead' | 'Search',
  payload?: Record<string, unknown>,
  eventId?: string,
) {
  if (typeof window === 'undefined' || !window.ttq?.track) return null;

  const resolvedEventId = eventId || createTikTokEventId(eventName.toLowerCase());
  window.ttq.track(eventName, payload, { event_id: resolvedEventId });
  return resolvedEventId;
}
