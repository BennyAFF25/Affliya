"use client";

import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

type OfferRow = {
  id: string;
  website?: string | null;
  site_host?: string | null;
};

export default function SetupTrackingContent() {
  const session = useSession();
  const user = session?.user;
  const supabase = useSupabaseClient();
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [copiedUniversal, setCopiedUniversal] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<OfferRow | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [trackingInstalled, setTrackingInstalled] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState<string>("");

  const [verifyingPixel, setVerifyingPixel] = useState(false);
  const [pixelStatus, setPixelStatus] = useState<"idle" | "ok" | "fail">(
    "idle",
  );
  const [pixelMsg, setPixelMsg] = useState("");

  useEffect(() => {
    if (user) setIsReady(true);
  }, [user]);

  useEffect(() => {
    if (!isReady || !user?.email) return;

    const fetchOffers = async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("id, website, site_host")
        .eq("business_email", user.email);

      if (error || !data) return;
      setOffers(data as OfferRow[]);
      if (data.length > 0) setSelectedOffer((data as OfferRow[])[0]);
    };

    fetchOffers();
  }, [isReady, supabase, user?.email]);

  useEffect(() => {
    if (!selectedOffer?.website) {
      setTrackingCode("");
      return;
    }

    if (selectedOffer.site_host === "Shopify") {
      setTrackingCode("");
      return;
    }

    try {
      const domain = new URL(selectedOffer.website).hostname.replace(/^www\./, "");
      const baseUrl =
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : "https://www.nettmark.com";

      setTrackingCode(
        `<script src="${baseUrl}/tracker.js" data-business="${domain}" data-offer="${selectedOffer.id}"></script>`,
      );
    } catch {
      setTrackingCode("");
    }
  }, [selectedOffer]);

  const shopifyUniversalPixel = useMemo(() => {
    const apiUrl = "https://www.nettmark.com/api/track-event";
    return `const NETTMARK_API_URL = '${apiUrl}';
const ATTR_KEYS = {
  affiliate: 'nettmark_nm_aff',
  campaign: 'nettmark_nm_camp',
};

function safeUrl(event) {
  return event?.context?.document?.location?.href || null;
}

function safeReferrer(event) {
  return event?.context?.document?.referrer || null;
}

function queryParam(rawUrl, key) {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).searchParams.get(key);
  } catch (e) {
    return null;
  }
}

async function rememberAttr(key, value) {
  if (!value) return;
  try { await browser.localStorage.setItem(key, value); } catch (e) {}
  try { await browser.cookie.set(key, value); } catch (e) {}
}

async function readAttr(key) {
  try {
    const local = await browser.localStorage.getItem(key);
    if (local) return local;
  } catch (e) {}

  try {
    const cookie = await browser.cookie.get(key);
    if (cookie) return cookie;
  } catch (e) {}

  return null;
}

function normalizeLineItems(event) {
  const checkout = event?.data?.checkout;
  const lineItems = checkout?.lineItems;
  if (Array.isArray(lineItems)) return lineItems;
  if (Array.isArray(lineItems?.edges)) {
    return lineItems.edges.map((edge) => edge?.node || edge).filter(Boolean);
  }
  if (Array.isArray(lineItems?.nodes)) return lineItems.nodes;
  return event?.data?.line_items || event?.data?.lineItems || [];
}

async function sendEvent(eventName, event) {
  const pageUrl = safeUrl(event);
  const referrer = safeReferrer(event);

  const urlAffiliate = queryParam(pageUrl, 'nm_aff');
  const urlCampaign = queryParam(pageUrl, 'nm_camp');

  if (urlAffiliate) await rememberAttr(ATTR_KEYS.affiliate, urlAffiliate);
  if (urlCampaign) await rememberAttr(ATTR_KEYS.campaign, urlCampaign);

  const affiliateId = urlAffiliate || await readAttr(ATTR_KEYS.affiliate);
  const campaignId = urlCampaign || await readAttr(ATTR_KEYS.campaign);
  const payoutEligible = !!(affiliateId && campaignId);
  const outgoingEventType =
    (eventName === 'checkout_completed' && payoutEligible) ? 'conversion' : eventName;

  await fetch(NETTMARK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: outgoingEventType,
      affiliate_id: affiliateId,
      campaign_id: campaignId,
      event_data: {
        ...event?.data,
        original_event_name: eventName,
        url: pageUrl,
        page_url: pageUrl,
        referrer,
        nm_aff: affiliateId,
        nm_camp: campaignId,
        line_items: normalizeLineItems(event),
      }
    })
  });
}

analytics.subscribe('page_viewed', async (event) => {
  await sendEvent('page_viewed', event);
});

analytics.subscribe('cart_updated', async (event) => {
  await sendEvent('cart_updated', event);
});

analytics.subscribe('checkout_completed', async (event) => {
  await sendEvent('checkout_completed', event);
});`.trim();
  }, []);

  const isShopify = selectedOffer?.site_host === "Shopify";

  const copyText = async (value: string, kind: "main" | "shopify") => {
    await navigator.clipboard.writeText(value);
    if (kind === "main") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedUniversal(true);
      setTimeout(() => setCopiedUniversal(false), 2000);
    }
  };

  async function startCombinedTest() {
    try {
      setTestStatus("idle");
      setTestMsg("");

      if (!selectedOffer) {
        setTestStatus("fail");
        setTestMsg("Select an offer first.");
        return;
      }

      if (!user?.email) {
        setTestStatus("fail");
        setTestMsg("You need to be signed in as the business owner to run this test.");
        return;
      }

      setTesting(true);

      const res = await fetch("/api/test-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: selectedOffer.id,
          business_email: user.email,
        }),
      });

      if (!res.ok) {
        let errText = "Failed to record test event.";
        try {
          const json = await res.json();
          if (json?.error) errText = json.error;
        } catch {
          void 0;
        }

        setTestStatus("fail");
        setTestMsg(errText);
        return;
      }

      setTestStatus("ok");
      setTestMsg("Test event recorded. Nettmark is receiving tracking for this offer.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unexpected error while testing.";
      setTestStatus("fail");
      setTestMsg(message);
    } finally {
      setTesting(false);
    }
  }

  async function verifyMetaPixel() {
    try {
      setVerifyingPixel(true);
      setPixelStatus("idle");
      setPixelMsg("");

      const res = await fetch("/api/meta/verify-pixel", {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok) {
        setPixelStatus("fail");
        setPixelMsg(json?.error || "Pixel not detected yet.");
        return;
      }

      setPixelStatus("ok");
      setPixelMsg("Meta pixel detected successfully.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Verification failed.";
      setPixelStatus("fail");
      setPixelMsg(message);
    } finally {
      setVerifyingPixel(false);
    }
  }

  const handleSendEmail = async () => {
    if (!devEmail) return;
    await fetch("/api/send-tracking-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: devEmail,
        script: isShopify ? shopifyUniversalPixel : trackingCode,
        from: user?.email,
      }),
    });
    setEmailSent(true);
  };

  const StepCard = ({
    number,
    title,
    description,
    children,
  }: {
    number: string;
    title: string;
    description: string;
    children: ReactNode;
  }) => (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/12 text-sm font-bold text-[var(--primary)]">
          {number}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );

  return (
    <div className="setup-tracking-theme min-h-screen bg-[var(--background)] px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                Offer created
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Now let’s connect your tracking
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
                This page only needs to do two things: get the Nettmark tracking installed,
                then confirm it’s working. I’ve stripped the rest back so it’s easier to follow.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/business/my-business")}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--input-background)]"
            >
              Back to dashboard
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                Reserved space
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                Future guided setup demo
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                The old demo block has been cleared out so this page stays focused on installing and testing tracking. If you want a future <span className="font-medium text-[var(--foreground)]">gomarketme.co</span> walkthrough here, this section is ready for it.
              </p>
            </div>

            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted-foreground)] md:max-w-xs">
              Keep this area lightweight for now — no interactive demo, just room for a future tour drop-in.
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Choose offer"],
            ["2", "Install code"],
            ["3", "Verify tracking"],
          ].map(([n, label]) => (
            <div
              key={n}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted-foreground)]"
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/12 text-xs font-bold text-[var(--primary)]">
                {n}
              </span>
              <span className="font-medium text-[var(--foreground)]">{label}</span>
            </div>
          ))}
        </div>

        <StepCard
          number="1"
          title="Choose the offer you’re setting up"
          description="If you just created one, it should already be selected below."
        >
          {offers.length > 0 ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Offer
              </label>
              <select
                value={selectedOffer?.id || ""}
                onChange={(e) => {
                  const offer = offers.find((o) => o.id === e.target.value) || null;
                  setSelectedOffer(offer);
                  setEmailSent(false);
                  setTrackingInstalled(false);
                  setTestStatus("idle");
                  setTestMsg("");
                }}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] outline-none ring-2 ring-[var(--primary)]/5 transition focus:ring-[var(--ring)]"
              >
                {offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.website || offer.id}
                  </option>
                ))}
              </select>

              {selectedOffer && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                  Platform detected: <span className="font-semibold text-[var(--foreground)]">{selectedOffer.site_host || "Custom site"}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
              No offers found yet. Create an offer first, then come back here.
            </div>
          )}
        </StepCard>

        <StepCard
          number="2"
          title={isShopify ? "Install the Shopify pixel" : "Install the Nettmark script"}
          description={
            isShopify
              ? "Paste this once in Shopify Customer Events. That’s the main setup done."
              : "Add this once to your site’s global head so Nettmark can see visits and conversions."
          }
        >
          {selectedOffer ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--foreground)] sm:text-sm">
                  {isShopify ? shopifyUniversalPixel : trackingCode}
                </pre>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={() =>
                    copyText(isShopify ? shopifyUniversalPixel : trackingCode, isShopify ? "shopify" : "main")
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                >
                  <ClipboardDocumentIcon className="h-5 w-5" />
                  {isShopify
                    ? copiedUniversal
                      ? "Pixel copied"
                      : "Copy pixel"
                    : copied
                      ? "Code copied"
                      : "Copy code"}
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">What to do</h3>
                  {isShopify ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--muted-foreground)]">
                      <li>In Shopify, open <span className="font-medium text-[var(--foreground)]">Settings → Customer events</span>.</li>
                      <li>Create a <span className="font-medium text-[var(--foreground)]">custom pixel</span> called Nettmark.</li>
                      <li>Paste the code above, connect it, then save.</li>
                    </ol>
                  ) : (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--muted-foreground)]">
                      <li>Paste the script into your site’s global <code className="rounded bg-[var(--input-background)] px-1 py-0.5 text-xs">&lt;head&gt;</code>.</li>
                      <li>Make sure it loads across your site, especially product and thank-you pages.</li>
                      <li>Publish the change, then come back here to test.</li>
                    </ol>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Send this to your developer</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    If someone else is handling the website, email them the exact code from here.
                  </p>
                  <input
                    type="email"
                    placeholder="developer@example.com"
                    value={devEmail}
                    onChange={(e) => {
                      setDevEmail(e.target.value);
                      setEmailSent(false);
                    }}
                    className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none ring-2 ring-[var(--primary)]/5 focus:ring-[var(--ring)]"
                  />
                  <button
                    onClick={handleSendEmail}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--input-background)]"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                    {emailSent ? "Sent" : "Send to developer"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
              Pick an offer first so I can show the right install code.
            </div>
          )}
        </StepCard>

        <StepCard
          number="3"
          title="Verify that Nettmark is receiving tracking"
          description="Once you’ve installed the code, run a quick check from here."
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--muted-foreground)]">
              {isShopify ? (
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Save the pixel in Shopify.</li>
                  <li>Open your storefront once so the pixel can fire.</li>
                  <li>Come back here and run the tracking test.</li>
                </ol>
              ) : (
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Publish your site change.</li>
                  <li>Visit your site once after the script is live.</li>
                  <li>Come back here and run the tracking test.</li>
                </ol>
              )}
            </div>

            {!trackingInstalled ? (
              <button
                type="button"
                onClick={() => setTrackingInstalled(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
              >
                <CheckCircleIcon className="h-5 w-5" />
                I’ve installed it
              </button>
            ) : (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                Nice — tracking is marked as installed. Run the test below, or head back to your dashboard.
              </div>
            )}

            {trackingInstalled && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Run test tracking</h3>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      This creates a test event in Nettmark for the selected offer.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startCombinedTest}
                    disabled={testing || !selectedOffer}
                    className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 disabled:opacity-50"
                  >
                    {testing ? "Testing…" : "Test tracking"}
                  </button>
                </div>

                {(testStatus !== "idle" || testMsg) && (
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
                    <p
                      className={
                        testStatus === "ok"
                          ? "font-semibold text-emerald-300"
                          : testStatus === "fail"
                            ? "font-semibold text-red-300"
                            : "font-semibold text-[var(--foreground)]"
                      }
                    >
                      {testStatus === "ok"
                        ? "Tracking connected"
                        : testStatus === "fail"
                          ? "Tracking not confirmed yet"
                          : "Waiting to test"}
                    </p>
                    {testMsg && (
                      <p className="mt-1 text-[var(--muted-foreground)]">{testMsg}</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/business/my-business")}
                  className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--input-background)]"
                >
                  Return to dashboard
                </button>
              </div>
            )}
          </div>
        </StepCard>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Optional next step
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              Connect Meta Pixel for sales campaigns
            </h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              You only need this if you want conversion-optimised Meta sales campaigns.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--muted-foreground)]">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Install the Meta Pixel on your website.</li>
                <li>Open your website and browse at least one page.</li>
                <li>Come back here and verify it.</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
              <button
                type="button"
                onClick={verifyMetaPixel}
                disabled={verifyingPixel}
                className="w-full rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 disabled:opacity-50"
              >
                {verifyingPixel ? "Verifying…" : "Verify Meta Pixel"}
              </button>

              {(pixelStatus !== "idle" || pixelMsg) && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)]/60 p-4 text-sm">
                  <p
                    className={
                      pixelStatus === "ok"
                        ? "font-semibold text-emerald-300"
                        : pixelStatus === "fail"
                          ? "font-semibold text-red-300"
                          : "font-semibold text-[var(--foreground)]"
                    }
                  >
                    {pixelStatus === "ok"
                      ? "Meta Pixel connected"
                      : pixelStatus === "fail"
                        ? "Meta Pixel not detected yet"
                        : "Waiting to verify"}
                  </p>
                  {pixelMsg && (
                    <p className="mt-1 text-[var(--muted-foreground)]">{pixelMsg}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
