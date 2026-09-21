declare global {
  interface Window {
    ttq?: {
      identify?: (payload: Record<string, string>) => void;
      track?: (eventName: string, payload?: Record<string, unknown>) => void;
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
) {
  if (typeof window === 'undefined' || !window.ttq?.track) return;
  window.ttq.track(eventName, payload);
}
