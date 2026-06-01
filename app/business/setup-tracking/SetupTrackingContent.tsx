"use client";

import React, { useEffect, useMemo, useState } from "react";
import Script from "next/script";
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

type StepKey = "offer" | "install" | "verify" | "meta";
type StepState = "current" | "done" | "ready" | "locked";

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
  const [activeStep, setActiveStep] = useState<StepKey>("offer");
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [savingHost, setSavingHost] = useState(false);

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

analytics.subscribe('product_added_to_cart', async (event) => {
  await sendEvent('product_added_to_cart', event);
});

analytics.subscribe('checkout_completed', async (event) => {
  await sendEvent('checkout_completed', event);
});`.trim();
  }, []);

  const isShopify = selectedOffer?.site_host === "Shopify";
  const installSnippet = isShopify ? shopifyUniversalPixel : trackingCode;

  const updateOfferHost = async (host: string) => {
    if (!selectedOffer?.id) return;
    setSavingHost(true);
    try {
      const { error } = await supabase
        .from("offers")
        .update({ site_host: host })
        .eq("id", selectedOffer.id);

      if (error) {
        console.error("[setup-tracking host update failed]", error);
        return;
      }

      setSelectedOffer((prev) =>
        prev ? { ...prev, site_host: host } : prev,
      );
      setOffers((prev) =>
        prev.map((o) => (o.id === selectedOffer.id ? { ...o, site_host: host } : o)),
      );
    } finally {
      setSavingHost(false);
    }
  };

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
        script: installSnippet,
        from: user?.email,
      }),
    });
    setEmailSent(true);
  };

  const stepOrder: StepKey[] = ["offer", "install", "verify"];
  const currentStepIndex = stepOrder.indexOf(activeStep);
  const hasOffer = !!selectedOffer;
  const hasVerifiedTracking = testStatus === "ok";

  const getStepState = (step: StepKey): StepState => {
    if (step === activeStep) return "current";
    if (step === "offer") return hasOffer ? "done" : "ready";
    if (step === "install") {
      if (trackingInstalled) return "done";
      return hasOffer ? "ready" : "locked";
    }
    if (step === "verify") {
      if (hasVerifiedTracking) return "done";
      return trackingInstalled ? "ready" : "locked";
    }
    return "locked";
  };

  const steps = [
    {
      key: "offer" as StepKey,
      number: "01",
      title: "Choose offer",
      subtitle: "Pick the site you’re wiring up.",
    },
    {
      key: "install" as StepKey,
      number: "02",
      title: isShopify ? "Install pixel" : "Install script",
      subtitle: isShopify
        ? "Copy once into Shopify customer events."
        : "Add the Nettmark script to your site.",
    },
    {
      key: "verify" as StepKey,
      number: "03",
      title: "Verify tracking",
      subtitle: "Run one quick test from here.",
    },
  ];

  const nextStep = stepOrder[currentStepIndex + 1] || null;
  const prevStep = stepOrder[currentStepIndex - 1] || null;

  const summaryTitle = !selectedOffer
    ? "Choose an offer to get started"
    : activeStep === "offer"
      ? "Select the right storefront"
      : activeStep === "install"
        ? isShopify
          ? "Paste the Shopify pixel once"
          : "Add the script to your global head"
        : "Confirm Nettmark is receiving events";

  const summaryBody = !selectedOffer
    ? "Once an offer is selected, this flow will tailor the install steps to that site and platform."
    : activeStep === "offer"
      ? "We’ll keep the rest of the setup focused on this selected offer, so you’re not dealing with a giant mixed checklist."
      : activeStep === "install"
        ? "Copy the snippet on the right, publish it once, then move straight into verification."
        : "You shouldn’t need to leave this flow again after publishing — just mark it installed and run the test.";

  const goNext = () => {
    if (nextStep) setActiveStep(nextStep);
  };

  const goPrev = () => {
    if (prevStep) setActiveStep(prevStep);
  };

  const renderStepContent = () => {
    if (activeStep === "offer") {
      return (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Step 1
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              Choose the offer you’re setting up
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              If you just created an offer, it should already be selected below.
            </p>
          </div>

          {offers.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 space-y-4">
                <div>
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
                      setPixelStatus("idle");
                      setPixelMsg("");
                      setCodeExpanded(false);
                    }}
                    className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] outline-none ring-2 ring-[var(--primary)]/5 transition focus:ring-[var(--ring)]"
                  >
                    {offers.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.website || offer.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    Platform / Host
                  </label>
                  <select
                    value={selectedOffer?.site_host || "Custom site"}
                    onChange={(e) => void updateOfferHost(e.target.value)}
                    disabled={!selectedOffer || savingHost}
                    className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] outline-none ring-2 ring-[var(--primary)]/5 transition focus:ring-[var(--ring)] disabled:opacity-60"
                  >
                    <option value="Shopify">Shopify</option>
                    <option value="WooCommerce">WooCommerce</option>
                    <option value="Wix">Wix</option>
                    <option value="Custom site">Custom site</option>
                  </select>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {savingHost
                      ? "Saving platform…"
                      : "Choose the platform first so the install instructions match your setup."}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(0,194,203,0.08),transparent_55%)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                  Current setup target
                </p>
                <div className="mt-3 text-lg font-semibold text-[var(--foreground)] break-all">
                  {selectedOffer?.website || "No offer selected"}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                    Platform: {selectedOffer?.site_host || "Custom site"}
                  </span>
                  <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                    Offer ID: {selectedOffer?.id || "—"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">
                  Once this is selected, the code and test steps on the right stay locked to this offer so the setup feels smaller and safer.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
              No offers found yet. Create an offer first, then come back here.
            </div>
          )}
        </div>
      );
    }

    if (activeStep === "install") {
      return (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Step 2
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {isShopify ? "Install the Shopify pixel" : "Install the Nettmark script"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {isShopify
                ? "Paste this once in Shopify Customer Events and you’re basically done with setup."
                : "Add this once to your site’s global head so Nettmark can track visits and conversions."}
            </p>
          </div>

          {selectedOffer ? (
            <>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {isShopify ? "Tracking pixel" : "Tracking script"}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      Keep this collapsed if you just want the copy action. Expand it when you need to inspect or edit the full snippet.
                    </p>
                  </div>

                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    <button
                      onClick={() =>
                        copyText(installSnippet, isShopify ? "shopify" : "main")
                      }
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 sm:w-auto sm:min-w-[160px]"
                    >
                      <ClipboardDocumentIcon className="h-5 w-5 shrink-0" />
                      <span>
                        {isShopify
                          ? copiedUniversal
                            ? "Pixel copied"
                            : "Copy pixel"
                          : copied
                            ? "Code copied"
                            : "Copy code"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCodeExpanded((prev) => !prev)}
                      className="inline-flex min-h-[48px] w-full items-center justify-center whitespace-nowrap rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--card)] sm:w-auto sm:min-w-[160px]"
                    >
                      {codeExpanded ? "Hide full code" : "Show full code"}
                    </button>
                  </div>
                </div>

                {codeExpanded && (
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--foreground)] sm:text-sm">
                      {installSnippet}
                    </pre>
                  </div>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">What to do</h3>
                  {isShopify ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--muted-foreground)]">
                      <li>Open <span className="font-medium text-[var(--foreground)]">Settings → Customer events</span> in Shopify.</li>
                      <li>Create a <span className="font-medium text-[var(--foreground)]">custom pixel</span> called Nettmark.</li>
                      <li>Paste the code above, connect it, then save.</li>
                    </ol>
                  ) : (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--muted-foreground)]">
                      <li>Paste the script into your global <code className="rounded bg-[var(--card)] px-1 py-0.5 text-xs">&lt;head&gt;</code>.</li>
                      <li>Make sure it loads across the site, especially product and thank-you pages.</li>
                      <li>Publish the change, then come back here to verify.</li>
                    </ol>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Send this to your developer</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    If someone else is handling the site, email them the exact code from here.
                  </p>
                  <input
                    type="email"
                    placeholder="developer@example.com"
                    value={devEmail}
                    onChange={(e) => {
                      setDevEmail(e.target.value);
                      setEmailSent(false);
                    }}
                    className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] outline-none ring-2 ring-[var(--primary)]/5 focus:ring-[var(--ring)]"
                  />
                  <button
                    onClick={handleSendEmail}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--card)]"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                    {emailSent ? "Sent" : "Send to developer"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
              Pick an offer first so I can show the right install code.
            </div>
          )}
        </div>
      );
    }

    if (activeStep === "verify") {
      return (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Step 3
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              Verify Nettmark is receiving tracking
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Once the code is installed, run one quick check from here.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 text-sm text-[var(--muted-foreground)]">
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
              Nice — tracking is marked as installed. Run the test below.
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
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
                disabled={testing || !selectedOffer || !trackingInstalled}
                className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 disabled:opacity-50"
              >
                {testing ? "Testing…" : "Test tracking"}
              </button>
            </div>

            {(testStatus !== "idle" || testMsg) && (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
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
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="setup-tracking-theme min-h-screen bg-[var(--background)] px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                Offer created
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Set up your tracking
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
                Follow the steps below to connect your tracking, verify everything is working, and get your offer ready for affiliates to promote.
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

          <details className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:content-none">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Stuck? View the full setup tracking demo
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
                  Open the full walkthrough for installing tracking, verifying events, and finishing business-side setup.
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)] transition group-open:rotate-45">
                +
              </span>
            </summary>

            <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
              <Script
                src="https://js.storylane.io/js/v2/storylane.js"
                strategy="afterInteractive"
                data-verify-origin=""
              />
              <div
                className="sl-embed relative w-full overflow-hidden rounded-[1.2rem] bg-black"
                style={{
                  paddingBottom: "calc(65.19% + 25px)",
                  height: 0,
                  transform: "scale(1)",
                }}
              >
                <iframe
                  title="Business setup tracking walkthrough"
                  loading="lazy"
                  className="sl-demo absolute left-0 top-0 h-full w-full"
                  src="https://app.storylane.io/demo/fkrv6kdadcmz?embed=inline"
                  name="sl-embed"
                  allow="fullscreen"
                  allowFullScreen
                  style={{
                    border: "1px solid rgba(63,95,172,0.35)",
                    boxShadow: "0px 0px 18px rgba(26, 19, 72, 0.15)",
                    borderRadius: "10px",
                    boxSizing: "border-box",
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            </div>
          </details>
        </section>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="px-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                Setup steps
              </p>
              <div className="mt-4 space-y-2">
                {steps.map((step) => {
                  const state = getStepState(step.key);
                  const clickable = state !== "locked";
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => clickable && setActiveStep(step.key)}
                      disabled={!clickable}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        state === "current"
                          ? "border-[var(--primary)]/35 bg-[var(--primary)]/10 shadow-[0_10px_30px_rgba(0,194,203,0.08)]"
                          : state === "done"
                            ? "border-emerald-500/20 bg-emerald-500/10"
                            : state === "ready"
                              ? "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)]"
                              : "border-[var(--border)] bg-[var(--background)] opacity-55"
                      } disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            state === "current"
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : state === "done"
                                ? "bg-emerald-500 text-white"
                                : "bg-[var(--card)] text-[var(--foreground)]"
                          }`}
                        >
                          {state === "done" ? "✓" : step.number}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--foreground)]">
                            {step.title}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                            {step.subtitle}
                          </div>
                          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                            {state === "current"
                              ? "Current"
                              : state === "done"
                                ? "Done"
                                : state === "ready"
                                  ? "Ready"
                                  : "Locked"}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(0,194,203,0.08),transparent_60%)] p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                Live summary
              </p>
              <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                {summaryTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {summaryBody}
              </p>
              <div className="mt-4 space-y-2 text-sm text-[var(--muted-foreground)]">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                  Offer: <span className="font-medium text-[var(--foreground)] break-all">{selectedOffer?.website || "Not selected"}</span>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                  Platform: <span className="font-medium text-[var(--foreground)]">{selectedOffer?.site_host || "—"}</span>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                  Tracking: <span className="font-medium text-[var(--foreground)]">{hasVerifiedTracking ? "Verified" : trackingInstalled ? "Installed" : "Not confirmed"}</span>
                </div>
              </div>
            </section>
          </aside>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6 lg:p-7">
            {renderStepContent()}

            <div className="mt-8 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--muted-foreground)]">
                Move through the setup one step at a time.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {prevStep && (
                  <button
                    type="button"
                    onClick={goPrev}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--input-background)]"
                  >
                    Back
                  </button>
                )}

                {nextStep ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/business/my-business")}
                    className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                  >
                    Return to dashboard
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
