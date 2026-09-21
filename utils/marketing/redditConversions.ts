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
  externalId?: string | null;
};

function getRedditClickId() {
  if (typeof window === "undefined") return undefined;

  try {
    const current = new URLSearchParams(window.location.search).get("rdt_cid");
    if (current) {
      window.localStorage.setItem("nettmark.redditClickId", current);
      return current;
    }

    return window.localStorage.getItem("nettmark.redditClickId") || undefined;
  } catch {
    return undefined;
  }
}

export function trackRedditConversion({
  eventName,
  conversionId,
  email,
  externalId,
}: RedditConversionPayload) {
  if (typeof window === "undefined") return;

  const clickId = getRedditClickId();
  const sourceUrl = new URL(window.location.href);
  if (clickId && !sourceUrl.searchParams.has("rdt_cid")) {
    sourceUrl.searchParams.set("rdt_cid", clickId);
  }

  const eventSourceUrl = sourceUrl.toString();
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
      externalId: externalId || undefined,
      clickId,
      screenWidth: window.screen?.width || undefined,
      screenHeight: window.screen?.height || undefined,
    }),
  }).catch(() => {
    // Best-effort tracking only; never block the user flow.
  });
}
