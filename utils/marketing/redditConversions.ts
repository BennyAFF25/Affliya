export type RedditConversionName = "SignUp" | "CreateOffer";

declare global {
  interface Window {
    rdt?: (...args: any[]) => void;
  }
}

type RedditConversionPayload = {
  eventName: RedditConversionName;
  conversionId: string;
  email?: string | null;
};

export function trackRedditConversion({
  eventName,
  conversionId,
  email,
}: RedditConversionPayload) {
  if (typeof window === "undefined") return;

  const eventSourceUrl = window.location.href;
  const rdt = window.rdt;

  if (typeof rdt === "function") {
    if (eventName === "SignUp") {
      rdt("track", "SignUp", { conversionId });
    } else {
      rdt("track", "Custom", {
        customEventName: "CreateOffer",
        conversionId,
      });
    }
  }

  void fetch("/api/marketing/reddit-conversion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      conversionId,
      eventSourceUrl,
      email: email || undefined,
    }),
  }).catch(() => {
    // Best-effort tracking only; never block the user flow.
  });
}
