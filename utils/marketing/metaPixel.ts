import { NETTMARK_META_PIXEL_ID as META_PIXEL_ID } from "./metaConfig";

export { META_PIXEL_ID };

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
  }
}

function getFbq() {
  if (typeof window === "undefined") return null;
  if (typeof window.fbq !== "function") return null;
  return window.fbq;
}

export function trackMetaCustomEvent(eventName: string, params?: Record<string, unknown>) {
  const fbq = getFbq();
  if (!fbq) return;

  if (params && Object.keys(params).length > 0) {
    fbq("trackCustom", eventName, params);
    return;
  }

  fbq("trackCustom", eventName);
}

export function trackMetaStandardEvent(eventName: string, params?: Record<string, unknown>) {
  const fbq = getFbq();
  if (!fbq) return;

  if (params && Object.keys(params).length > 0) {
    fbq("track", eventName, params);
    return;
  }

  fbq("track", eventName);
}
