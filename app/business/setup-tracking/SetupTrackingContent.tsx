"use client";

import { useEffect, useState } from "react";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import {
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

export default function SetupTrackingContent() {
  const session = useSession();
  const user = session?.user;
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [isReady, setIsReady] = useState(false);

  // Collapsible sections for Shopify pixels
  const [showViewPixel, setShowViewPixel] = useState(false);
  const [showCartPixel, setShowCartPixel] = useState(false);
  const [showCheckoutPixel, setShowCheckoutPixel] = useState(false);
  const [copiedView, setCopiedView] = useState(false);
  const [copiedCart, setCopiedCart] = useState(false);
  const [copiedCheckout, setCopiedCheckout] = useState(false);

  // New state for live campaign
  const [liveCampaign, setLiveCampaign] = useState<any>(null);
  const [loadingLiveCampaign, setLoadingLiveCampaign] = useState(false);

  // New state for universal pixel collapsible and copied state
  const [showUniversalPixel, setShowUniversalPixel] = useState(false);
  const [copiedUniversal, setCopiedUniversal] = useState(false);

  // Tracking Test state
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState<string>("");
  const [trackingMarkedInstalled, setTrackingMarkedInstalled] = useState(false);
  const [showInstallPanel, setShowInstallPanel] = useState(true);

  // Meta Pixel verification state
  const [verifyingPixel, setVerifyingPixel] = useState(false);
  const [pixelStatus, setPixelStatus] = useState<"idle" | "ok" | "fail">(
    "idle",
  );
  const [pixelMsg, setPixelMsg] = useState("");
  // Combined test: creates a test tracking event in Nettmark for this offer
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
        setTestMsg(
          "You need to be signed in as the business owner to run this test.",
        );
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
          if (json?.error) {
            errText = json.error;
          }
        } catch (_) {}

        setTestStatus("fail");
        setTestMsg(errText);
        return;
      }

      setTestStatus("ok");
      setTestMsg(
        "Test event recorded. Nettmark is receiving tracking for this offer.",
      );
    } catch (e: any) {
      setTestStatus("fail");
      setTestMsg(e?.message || "Unexpected error while testing.");
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
    } catch (e: any) {
      setPixelStatus("fail");
      setPixelMsg(e?.message || "Verification failed.");
    } finally {
      setVerifyingPixel(false);
    }
  }

  useEffect(() => {
    if (user) setIsReady(true);
  }, [user]);

  useEffect(() => {
    if (!isReady) return;

    const fetchOffers = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("offers")
        .select("id, website, site_host")
        .eq("business_email", user.email);
      if (data && !error) {
        setOffers(data);
        if (data.length > 0) {
          setSelectedOffer(data[0]);
        }
      }
    };

    fetchOffers();
  }, [isReady]);

  // Fetch live campaign when selectedOffer changes
  useEffect(() => {
    if (!selectedOffer) {
      setLiveCampaign(null);
      return;
    }
    const fetchLiveCampaign = async () => {
      setLoadingLiveCampaign(true);
      const { data, error } = await supabase
        .from("live_campaigns")
        .select("id")
        .eq("offer_id", selectedOffer.id)
        .limit(1)
        .single();
      if (data && !error) {
        setLiveCampaign(data);
      } else {
        setLiveCampaign(null);
      }
      setLoadingLiveCampaign(false);
    };
    fetchLiveCampaign();
  }, [selectedOffer]);

  useEffect(() => {
    if (selectedOffer) {
      if (selectedOffer.site_host === "Shopify") {
        // For Shopify, don't set trackingCode (handled in render), but set to empty string for copying fallback
        setTrackingCode("");
      } else {
        const domain = new URL(selectedOffer.website).hostname.replace(
          /^www\./,
          "",
        );
        const baseUrl =
          process.env.NODE_ENV === "development"
            ? "http://localhost:3000"
            : "https://www.nettmark.com";
        setTrackingCode(
          `<script src="${baseUrl}/tracker.js" data-business="${domain}" data-offer="${selectedOffer.id}"></script>`,
        );
      }
    }
  }, [selectedOffer, user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendEmail = async () => {
    if (!devEmail) return;
    await fetch("/api/send-tracking-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: devEmail,
        script: trackingCode,
        from: user?.email,
      }),
    });
    setEmailSent(true);
  };

  return (
    <div className="setup-tracking-theme min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto mt-12 max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-[var(--foreground)] shadow-lg ring-2 ring-[var(--primary)]/10">
        <h1 className="text-4xl font-extrabold mb-6 text-[var(--primary)] tracking-tight text-center">
          Install Your Nettmark Tracking Code
        </h1>
        <p className="mb-6 text-[var(--muted-foreground)] leading-relaxed text-center">
          <span className="font-semibold text-[var(--foreground)]">
            To track affiliate sales and automate payouts,
          </span>{" "}
          please install this code on your website’s{" "}
          <code className="bg-[var(--input-background)] px-1 py-0.5 rounded text-sm font-mono text-[var(--primary)]">
            &lt;head&gt;
          </code>{" "}
          tag:
        </p>

        {offers.length > 0 && (
          <div className="mb-4">
            <label className="block font-semibold text-sm text-[var(--muted-foreground)] mb-1">
              Select Offer:
            </label>
            <select
              value={selectedOffer?.id || ""}
              onChange={(e) => {
                const offer = offers.find((o) => o.id === e.target.value);
                setSelectedOffer(offer);
              }}
              className="border rounded px-3 py-2 w-full border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] ring-2 ring-[var(--primary)]/10 focus:ring-[var(--ring)] focus:outline-none transition"
            >
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.website}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedOffer?.site_host === "Shopify" ? (
          <>
            {!loadingLiveCampaign && !liveCampaign && (
              <div className="mb-4 p-2 rounded bg-[var(--card)] text-[var(--primary)] font-semibold text-center text-sm">
                No affiliates are promoting this offer yet. Your tracking is
                ready!
              </div>
            )}
            {(() => {
              const apiUrl = "https://www.nettmark.com/api/track-event";
              let shopifyUniversalPixel = `
<!-- Nettmark Shopify Universal Pixel -->
<script>
  analytics.subscribe('page_viewed', async (event) => {
    await fetch('${apiUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'page_viewed',
        event_data: event?.data
      })
    });
  });
  analytics.subscribe('cart_updated', async (event) => {
    await fetch('${apiUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'cart_updated',
        event_data: event?.data
      })
    });
  });
  analytics.subscribe('checkout_completed', async (event) => {
    await fetch('${apiUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'checkout_completed',
        event_data: event?.data
      })
    });
  });
</script>
`.trim();

              return (
                <div className="rounded-lg bg-[var(--card)] border border-[var(--border)]">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left text-[var(--primary)] font-semibold hover:bg-[var(--card)] focus:outline-none"
                    onClick={() => setShowUniversalPixel((v) => !v)}
                  >
                    Nettmark Shopify Universal Pixel (Install in Customer
                    Events)
                    <span>{showUniversalPixel ? "▲" : "▼"}</span>
                  </button>
                  {showUniversalPixel && (
                    <div className="px-4 pb-4">
                      <pre className="bg-[var(--input-background)] p-3 rounded mb-2 overflow-x-auto text-xs border border-[var(--border)] whitespace-pre-wrap">
                        {shopifyUniversalPixel}
                      </pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shopifyUniversalPixel);
                          setCopiedUniversal(true);
                          setTimeout(() => setCopiedUniversal(false), 2000);
                        }}
                        className="bg-[var(--primary)] hover:brightness-110 text-[var(--primary-foreground)] px-4 py-1 rounded text-xs font-semibold"
                      >
                        {copiedUniversal ? "Copied!" : "Copy Pixel"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <pre className="bg-[var(--card)] text-[var(--primary)] p-4 rounded-lg border border-dashed border-[var(--border)] text-sm overflow-x-auto mb-6 transition-all duration-300 shadow-inner whitespace-pre-wrap">
              {trackingCode}
            </pre>
            <button
              onClick={handleCopy}
              className="bg-[var(--primary)] hover:brightness-110 text-[var(--primary-foreground)] px-5 py-2 rounded-lg font-semibold shadow-md transition duration-200 mr-2 flex items-center gap-2"
            >
              <ClipboardDocumentIcon className="h-5 w-5" />{" "}
              {copied ? "Copied!" : "Copy Code"}
            </button>
          </>
        )}

        {/* -------- Meta Pixel (Sales campaigns) -------- */}
        <div className="mt-8 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--primary)]">
              Meta Pixel (Required for Sales)
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Required to run conversion‑optimised (Sales) campaigns on Meta.
            </p>
          </div>

          <div className="p-5 space-y-4 text-sm text-[var(--muted-foreground)]">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Install the Meta Pixel on your website (Shopify or custom).
              </li>
              <li>Open your website in a new tab and browse a page.</li>
              <li>
                Return here and click{" "}
                <span className="text-[var(--foreground)] font-medium">
                  Verify Pixel
                </span>
                .
              </li>
            </ol>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={verifyMetaPixel}
                disabled={verifyingPixel}
                className="px-4 py-2 rounded-md bg-[var(--primary)] hover:brightness-110 text-[var(--primary-foreground)] text-sm font-semibold disabled:opacity-50"
              >
                {verifyingPixel ? "Verifying…" : "Verify Pixel"}
              </button>

              {pixelStatus === "ok" && (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  Connected
                </span>
              )}

              {pixelStatus === "fail" && (
                <span className="text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-200 border border-red-500/25">
                  Not detected
                </span>
              )}
            </div>

            {pixelMsg && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {pixelMsg}
              </p>
            )}

            <div className="text-[11px] text-[var(--muted-foreground)]">
              Sales campaigns are only enabled once the Meta Pixel is detected.
            </div>
          </div>
        </div>

        {/* -------- Implementation Instructions -------- */}
        <div className="mt-8 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setShowInstallPanel(!showInstallPanel)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-[#7ff5fb] hover:bg-[var(--input-background)] rounded-t-xl"
          >
            <span>How to install &amp; test tracking</span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {showInstallPanel ? "Hide" : "Show"}
            </span>
          </button>

          {showInstallPanel && (
            <div className="border-t border-[var(--border)] p-5 rounded-b-xl">
              <h2 className="text-lg font-semibold text-[#7ff5fb] mb-3">
                How to install tracking
              </h2>

              {selectedOffer?.site_host === "Shopify" ? (
                <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>
                      In your Shopify admin go to{" "}
                      <span className="text-[var(--foreground)] font-medium">
                        Settings → Customer events
                      </span>
                      .
                    </li>
                    <li>
                      Click{" "}
                      <span className="text-[var(--foreground)] font-medium">
                        Add custom pixel
                      </span>
                      , name it{" "}
                      <span className="text-[var(--foreground)] font-medium">
                        Nettmark
                      </span>
                      , then paste the pixel shown above.
                    </li>
                    <li>
                      Click{" "}
                      <span className="text-[var(--foreground)] font-medium">
                        Connect
                      </span>{" "}
                      (to allow the pixel to run) and then{" "}
                      <span className="text-[var(--foreground)] font-medium">
                        Save
                      </span>
                      .
                    </li>
                  </ol>

                  <div className="mt-2 rounded-lg bg-[var(--card)] border border-[var(--border)] p-3">
                    <p className="text-[#7ff5fb] font-medium mb-1">
                      Privacy settings in Shopify
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        Under{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Permission
                        </span>
                        , choose{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Required
                        </span>{" "}
                        with{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Marketing
                        </span>{" "}
                        and{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Analytics
                        </span>{" "}
                        checked.
                      </li>
                      <li>
                        Under{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Data sale
                        </span>
                        , choose{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Data collected qualifies as data sale
                        </span>{" "}
                        (or the closest available option for your region).
                      </li>
                    </ul>
                  </div>

                  <div className="mt-3 rounded-lg bg-[var(--card)] border border-[var(--border)] p-3">
                    <p className="text-[#7ff5fb] font-medium mb-1">
                      Quick verify (optional)
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        After saving your pixel, click{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Click finish once your tracking code is installed
                        </span>{" "}
                        on this page.
                      </li>
                      <li>
                        Then use the{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Test Tracking
                        </span>{" "}
                        button below. If everything is set up, Nettmark will
                        record a test event for this offer.
                      </li>
                      <li>
                        Once an affiliate campaign is live and sending traffic,
                        tracking will also be confirmed automatically from real
                        clicks and sales.
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
                  <p className="mb-1">
                    Add the script below to the{" "}
                    <code className="bg-[var(--input-background)] px-1 py-0.5 rounded text-xs text-[var(--primary)]">
                      &lt;head&gt;
                    </code>{" "}
                    of your site templates:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Home / global layout (loads on all pages)</li>
                    <li>Product &amp; cart templates</li>
                    <li>Checkout / thank‑you page template</li>
                  </ul>
                  <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-3">
                    <p className="text-[#7ff5fb] font-medium mb-1">
                      Alternative (GTM)
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>
                        Create a new{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          Custom HTML
                        </span>{" "}
                        tag with the script.
                      </li>
                      <li>
                        Trigger on{" "}
                        <span className="text-[var(--foreground)] font-medium">
                          All Pages
                        </span>{" "}
                        and your purchase/thank‑you events.
                      </li>
                      <li>Publish the container.</li>
                    </ol>
                  </div>
                  <div className="mt-2 rounded-lg bg-[var(--card)] border border-[var(--border)] p-3">
                    <p className="text-[#7ff5fb] font-medium mb-1">
                      Quick verify (optional)
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        Visit your site with{" "}
                        <code className="bg-[var(--input-background)] px-1 py-0.5 rounded text-xs">
                          ?nm_aff=you@example.com&amp;nm_camp=YOUR_CAMPAIGN_ID
                        </code>
                        .
                      </li>
                      <li>
                        Perform a test purchase or completion flow; confirm
                        events appear in Nettmark.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Mark tracking installed */}
              <div className="mt-8 flex flex-col items-center gap-4">
                {!trackingMarkedInstalled ? (
                  <button
                    type="button"
                    onClick={() => setTrackingMarkedInstalled(true)}
                    className="px-6 py-3 rounded-full bg-[var(--primary)] hover:brightness-110 text-[var(--primary-foreground)] text-sm font-semibold shadow-lg transition"
                  >
                    Finish installation
                  </button>
                ) : (
                  <>
                    <p className="text-sm text-[#7ff5fb] text-center">
                      Tracking marked as installed. You can test it now or
                      return to your dashboard.
                    </p>

                    <button
                      type="button"
                      onClick={() => router.push("/business/my-business")}
                      className="px-6 py-3 rounded-full bg-[var(--primary)] hover:brightness-110 text-[var(--primary-foreground)] text-sm font-semibold shadow-lg transition"
                    >
                      Return to dashboard
                    </button>
                  </>
                )}
              </div>

              {/* --- Quick Tracking Test (shown after marking installed) --------------- */}
              {trackingMarkedInstalled && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold tracking-wide text-[#7ff5fb]">
                      Test Your Pixel
                    </h2>
                  </div>

                  {offers.length === 0 ? (
                    <div className="text-sm text-[var(--muted-foreground)]">
                      Create your first Offer to test tracking. Once an offer
                      exists, we’ll record a test event for that offer.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="text-xs text-[var(--muted-foreground)] md:col-span-1">
                          Offer
                        </label>
                        <select
                          className="md:col-span-2 bg-[var(--input-background)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--ring)]"
                          value={selectedOffer?.id || ""}
                          onChange={(e) => {
                            const offer = offers.find(
                              (o) => o.id === e.target.value,
                            );
                            setSelectedOffer(offer || null);
                          }}
                        >
                          {offers.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.website || o.id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={startCombinedTest}
                          disabled={testing || !selectedOffer}
                          className="px-4 py-2 rounded-md bg-[var(--primary)] hover:brightness-110 text-[var(--primary-foreground)] text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {testing ? "Testing…" : "Test Tracking"}
                        </button>

                        {testStatus === "ok" && (
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                            Connected
                          </span>
                        )}
                        {testStatus === "fail" && (
                          <span className="text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-200 border border-red-500/25">
                            No event
                          </span>
                        )}
                      </div>

                      {testMsg && (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {testMsg}
                        </p>
                      )}

                      <div className="text-[11px] text-[var(--muted-foreground)] pt-1">
                        Creates a test tracking event in Nettmark for this offer
                        so you can confirm tracking is connected.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="font-medium mb-2">Or send to your developer:</h2>
          <input
            type="email"
            placeholder="developer@example.com"
            value={devEmail}
            onChange={(e) => setDevEmail(e.target.value)}
            className="border rounded-lg px-4 py-2 w-full mb-3 shadow-sm border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] ring-2 ring-[var(--primary)]/10 focus:ring-[var(--ring)] focus:outline-none transition"
          />
          <button
            onClick={handleSendEmail}
            className="bg-[var(--card)] hover:bg-[var(--primary)]/10 border border-[var(--border)] text-[var(--primary)] px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2 ring-2 ring-[var(--primary)]/10"
          >
            <PaperAirplaneIcon className="h-5 w-5" />{" "}
            {emailSent ? "Sent" : "Send Code"}
          </button>
        </div>
      </div>
    </div>
  );
}
