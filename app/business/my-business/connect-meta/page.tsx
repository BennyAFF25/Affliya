"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Layers3,
  Link2,
  Megaphone,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from "lucide-react";

type MetaConnection = {
  id: string;
  meta_user_name: string | null;
  meta_user_email: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  page_id: string | null;
  page_name: string | null;
  pixel_id?: string | null;
  pixel_name?: string | null;
};

type Offer = {
  id: string;
  title: string | null;
  website?: string | null;
  meta_page_id?: string | null;
  meta_page_name?: string | null;
  meta_ad_account_id?: string | null;
  meta_ad_account_name?: string | null;
  meta_pixel_id?: string | null;
  meta_pixel_name?: string | null;
};

type PixelOption = {
  id: string;
  name: string;
  ad_account_id: string;
};

type OfferAssetDraft = {
  pageId: string;
  adAccountId: string;
  pixelId: string;
};

const baseOAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=https://www.nettmark.com/api/meta/callback&scope=pages_show_list,ads_management,business_management,pages_read_engagement,pages_read_user_content,ads_read,pages_manage_ads&response_type=code`;

function uniqBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function getOfferMapped(offer: Offer) {
  return Boolean(offer.meta_page_id && offer.meta_ad_account_id);
}

function encodeState(returnTo: string) {
  if (typeof window === "undefined") return encodeURIComponent(returnTo);
  return encodeURIComponent(window.btoa(returnTo));
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        connected
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
          : "border-amber-500/20 bg-amber-500/10 text-amber-500"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      {connected ? "Meta connected" : "Needs connection"}
    </span>
  );
}

function ConnectMetaPageInner() {
  const searchParams = useSearchParams();
  const session = useSession();
  const user = session?.user;

  const [connections, setConnections] = useState<MetaConnection[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OfferAssetDraft>>({});
  const [pixelsByAdAccount, setPixelsByAdAccount] = useState<Record<string, PixelOption[]>>({});
  const [pixelsLoadingByOffer, setPixelsLoadingByOffer] = useState<Record<string, boolean>>({});
  const [savingByOffer, setSavingByOffer] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isOnboard = searchParams?.get("onboard") === "1";
  const connectedParam = searchParams?.get("connected") === "1";
  const connected = connections.length > 0;

  const returnTo = `/business/my-business/connect-meta${isOnboard ? "?onboard=1&connected=1" : "?connected=1"}`;
  const oauthUrl = `${baseOAuthUrl}&state=${encodeState(returnTo)}`;

  const uniquePages = useMemo(
    () => uniqBy(connections, (connection) => connection.page_id),
    [connections],
  );
  const uniqueAdAccounts = useMemo(
    () => uniqBy(connections, (connection) => connection.ad_account_id),
    [connections],
  );
  const connectedUser =
    connections.find((connection) => connection.meta_user_name || connection.meta_user_email) ||
    null;

  const unmappedOffers = useMemo(
    () => offers.filter((offer) => !getOfferMapped(offer)),
    [offers],
  );
  const allOffersMapped = offers.length > 0 && unmappedOffers.length === 0;
  const needsAssetMapping = connected && offers.length > 0 && unmappedOffers.length > 0;

  const loadPixels = useCallback(
    async (offerId: string, adAccountId: string) => {
      if (!user?.email || !adAccountId) return;
      if (pixelsByAdAccount[adAccountId]) return;

      setPixelsLoadingByOffer((current) => ({ ...current, [offerId]: true }));
      try {
        const res = await fetch("/api/meta/get-datasets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business_email: user.email,
            ad_account_id: adAccountId,
          }),
        });
        const json = await res.json().catch(() => null);
        const pixels = Array.isArray(json?.pixels)
          ? json.pixels.map((pixel: any) => ({
              id: String(pixel?.id || ""),
              name: String(pixel?.name || `Pixel ${pixel?.id || ""}`),
              ad_account_id: String(pixel?.ad_account_id || adAccountId),
            })).filter((pixel: PixelOption) => pixel.id)
          : [];
        setPixelsByAdAccount((current) => ({ ...current, [adAccountId]: pixels }));
      } catch (err) {
        console.error("[connect-meta] failed to load pixels", err);
      } finally {
        setPixelsLoadingByOffer((current) => ({ ...current, [offerId]: false }));
      }
    },
    [pixelsByAdAccount, user?.email],
  );

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      const [connectionsRes, offersRes] = await Promise.all([
        supabase
          .from("meta_connections")
          .select(
            `
            id,
            meta_user_name,
            meta_user_email,
            ad_account_id,
            ad_account_name,
            page_id,
            page_name,
            pixel_id,
            pixel_name
          `,
          )
          .eq("business_email", user.email as string)
          .order("created_at", { ascending: true }),
        supabase
          .from("offers")
          .select(
            "id,title,website,meta_page_id,meta_page_name,meta_ad_account_id,meta_ad_account_name,meta_pixel_id,meta_pixel_name",
          )
          .eq("business_email", user.email as string)
          .order("created_at", { ascending: false }),
      ]);

      if (connectionsRes.error) {
        console.error("❌ Failed to load Meta connections:", connectionsRes.error);
        setConnections([]);
        setError("Could not load Meta connections right now.");
      } else {
        setConnections((connectionsRes.data || []) as MetaConnection[]);
      }

      if (offersRes.error) {
        console.error("❌ Failed to load offers:", offersRes.error);
        setOffers([]);
        setError("Could not load offers right now.");
      } else {
        const loadedOffers = (offersRes.data || []) as Offer[];
        setOffers(loadedOffers);
        setDrafts(
          loadedOffers.reduce<Record<string, OfferAssetDraft>>((acc, offer) => {
            acc[offer.id] = {
              pageId: offer.meta_page_id || "",
              adAccountId: offer.meta_ad_account_id || "",
              pixelId: offer.meta_pixel_id || "",
            };
            return acc;
          }, {}),
        );
      }

      setLoading(false);
    };

    loadData();
  }, [user?.email]);

  useEffect(() => {
    Object.entries(drafts).forEach(([offerId, draft]) => {
      if (draft.adAccountId) void loadPixels(offerId, draft.adAccountId);
    });
  }, [drafts, loadPixels]);

  useEffect(() => {
    if (connectedParam && connected) {
      setNotice("Meta connected. Attach those assets to each offer so affiliates can launch paid ads.");
    }
  }, [connectedParam, connected]);

  const setDraft = (offerId: string, patch: Partial<OfferAssetDraft>) => {
    setDrafts((current) => ({
      ...current,
      [offerId]: {
        pageId: current[offerId]?.pageId || "",
        adAccountId: current[offerId]?.adAccountId || "",
        pixelId: current[offerId]?.pixelId || "",
        ...patch,
      },
    }));
  };

  const saveOfferAssets = async (offer: Offer) => {
    if (!user?.email) return;
    const draft = drafts[offer.id];
    if (!draft?.pageId || !draft?.adAccountId) {
      setError("Choose both a Meta page and ad account before saving this offer.");
      return;
    }

    const selectedPage = uniquePages.find((page) => page.page_id === draft.pageId);
    const selectedAdAccount = uniqueAdAccounts.find(
      (account) => account.ad_account_id === draft.adAccountId,
    );
    const selectedPixel = (pixelsByAdAccount[draft.adAccountId] || []).find(
      (pixel) => pixel.id === draft.pixelId,
    );

    setSavingByOffer((current) => ({ ...current, [offer.id]: true }));
    setError(null);
    setNotice(null);

    const { error: updateError } = await (supabase as any)
      .from("offers")
      .update({
        meta_page_id: draft.pageId,
        meta_page_name: selectedPage?.page_name || null,
        meta_ad_account_id: draft.adAccountId,
        meta_ad_account_name: selectedAdAccount?.ad_account_name || null,
        meta_pixel_id: draft.pixelId || null,
        meta_pixel_name: selectedPixel?.name || null,
      })
      .eq("id", offer.id)
      .eq("business_email", user.email as string);

    setSavingByOffer((current) => ({ ...current, [offer.id]: false }));

    if (updateError) {
      console.error("[connect-meta] failed to save offer assets", updateError);
      setError("Could not save Meta assets for this offer right now.");
      return;
    }

    setOffers((current) =>
      current.map((item) =>
        item.id === offer.id
          ? {
              ...item,
              meta_page_id: draft.pageId,
              meta_page_name: selectedPage?.page_name || null,
              meta_ad_account_id: draft.adAccountId,
              meta_ad_account_name: selectedAdAccount?.ad_account_name || null,
              meta_pixel_id: draft.pixelId || null,
              meta_pixel_name: selectedPixel?.name || null,
            }
          : item,
      ),
    );
    setNotice(`Meta assets attached to ${offer.title || "offer"}.`);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {isOnboard && (
          <section className="rounded-[24px] border border-[var(--primary)]/20 bg-[var(--card)] p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  Onboarding · Step 2 of 4
                </div>
                <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                  Connect Meta, then attach assets to your offer
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
                  Offers created during onboarding need their Meta Page and Ad Account attached here before affiliates can launch paid ads.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/business/my-business"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--background)]"
                >
                  Back to onboarding
                </Link>
                {!connected ? (
                  <a
                    href={oauthUrl}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                  >
                    Connect Meta
                  </a>
                ) : offers.length === 0 ? (
                  <Link
                    href="/business/my-business/create-offer?onboard=1"
                    className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                  >
                    Continue to create offer
                  </Link>
                ) : allOffersMapped ? (
                  <Link
                    href="/business/setup-tracking?onboard=1"
                    className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                  >
                    Continue to tracking
                  </Link>
                ) : (
                  <a
                    href="#attach-meta-assets"
                    className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
                  >
                    Attach assets to continue
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {(notice || error) && (
          <section
            className={`rounded-2xl border p-4 text-sm ${
              error
                ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
            }`}
          >
            {error || notice}
          </section>
        )}

        <section className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(0,194,203,0.14),rgba(255,255,255,0.96)_45%,rgba(0,194,203,0.08))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:bg-[linear-gradient(135deg,rgba(0,194,203,0.18),rgba(17,24,39,0.92)_45%,rgba(0,194,203,0.1))] md:p-8">
          <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-3 py-1 text-xs font-semibold text-[var(--primary)] backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Meta Ads setup
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
                    Connect your Meta assets in one clean setup
                  </h1>
                  <StatusPill connected={connected} />
                </div>
                <p className="max-w-xl text-sm leading-6 text-[var(--muted-foreground)] md:text-base">
                  Link your Meta login, pages, and ad accounts, then attach the right assets to each offer so paid campaign launches do not get blocked later.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={oauthUrl}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_14px_35px_rgba(0,194,203,0.28)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  {connected ? <RefreshCcw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {connected ? "Reconnect Meta" : "Connect Meta"}
                </a>
                {connected && needsAssetMapping ? (
                  <a
                    href="#attach-meta-assets"
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-600 backdrop-blur transition hover:bg-amber-500/15 dark:text-amber-300"
                  >
                    Attach assets
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : isOnboard && offers.length === 0 ? (
                  <Link
                    href="/business/my-business/create-offer?onboard=1"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-5 py-3 text-sm font-semibold text-[var(--foreground)] backdrop-blur transition hover:bg-[var(--card)]"
                  >
                    Continue to create offer
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    href={allOffersMapped ? "/business/setup-tracking" : "/business/my-business/create-offer"}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-5 py-3 text-sm font-semibold text-[var(--foreground)] backdrop-blur transition hover:bg-[var(--card)]"
                  >
                    {allOffersMapped ? "Setup tracking" : "Create offer"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>

            <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/82 p-4 backdrop-blur">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">Meta pages</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{uniquePages.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/82 p-4 backdrop-blur">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">Ad accounts</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{uniqueAdAccounts.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/82 p-4 backdrop-blur">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">Offer mapping</div>
                <div className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {loading ? "Checking…" : offers.length === 0 ? "No offers yet" : allOffersMapped ? "Ready" : `${unmappedOffers.length} to attach`}
                </div>
              </div>
            </div>
          </div>
        </section>

        {connected && offers.length > 0 && (
          <section id="attach-meta-assets" className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <Save className="h-4 w-4 text-[var(--primary)]" />
                  Attach Meta assets to offers
                </div>
                <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
                  Paid ads require each offer to know which Facebook Page and Ad Account it belongs to. Pixel is optional unless you launch Sales campaigns.
                </p>
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {offers.length - unmappedOffers.length}/{offers.length} offers mapped
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {offers.map((offer) => {
                const draft = drafts[offer.id] || { pageId: "", adAccountId: "", pixelId: "" };
                const pixels = draft.adAccountId ? pixelsByAdAccount[draft.adAccountId] || [] : [];
                const mapped = getOfferMapped(offer);

                return (
                  <article key={offer.id} className="rounded-3xl border border-[var(--border)] bg-[var(--background)]/60 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-[var(--foreground)]">
                            {offer.title || "Untitled offer"}
                          </h3>
                          {mapped ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Assets attached
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
                              Needs assets
                            </span>
                          )}
                        </div>
                        {offer.website && (
                          <p className="mt-1 break-all text-xs text-[var(--muted-foreground)]">{offer.website}</p>
                        )}
                      </div>

                      <Link
                        href={`/business/my-business/edit-offer/${offer.id}`}
                        className="text-sm font-semibold text-[var(--primary)] hover:underline"
                      >
                        Full edit
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-4">
                      <label className="space-y-1.5 lg:col-span-1">
                        <span className="text-xs font-semibold text-[var(--muted-foreground)]">Facebook Page</span>
                        <select
                          value={draft.pageId}
                          onChange={(e) => setDraft(offer.id, { pageId: e.target.value })}
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                        >
                          <option value="">Select page</option>
                          {uniquePages.map((page) => (
                            <option key={page.page_id || page.id} value={page.page_id || ""}>
                              {page.page_name || page.page_id || "Untitled page"}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 lg:col-span-1">
                        <span className="text-xs font-semibold text-[var(--muted-foreground)]">Ad Account</span>
                        <select
                          value={draft.adAccountId}
                          onChange={(e) => setDraft(offer.id, { adAccountId: e.target.value, pixelId: "" })}
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                        >
                          <option value="">Select ad account</option>
                          {uniqueAdAccounts.map((account) => (
                            <option key={account.ad_account_id || account.id} value={account.ad_account_id || ""}>
                              {account.ad_account_name || account.ad_account_id || "Unnamed ad account"}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 lg:col-span-1">
                        <span className="text-xs font-semibold text-[var(--muted-foreground)]">Pixel optional</span>
                        <select
                          value={draft.pixelId}
                          disabled={!draft.adAccountId || Boolean(pixelsLoadingByOffer[offer.id])}
                          onChange={(e) => setDraft(offer.id, { pixelId: e.target.value })}
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">
                            {pixelsLoadingByOffer[offer.id] ? "Loading pixels…" : "No pixel / choose later"}
                          </option>
                          {pixels.map((pixel) => (
                            <option key={pixel.id} value={pixel.id}>
                              {pixel.name || pixel.id}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => void saveOfferAssets(offer)}
                          disabled={Boolean(savingByOffer[offer.id]) || !draft.pageId || !draft.adAccountId}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingByOffer[offer.id] ? "Saving…" : "Save assets"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <BadgeCheck className="h-4 w-4 text-[var(--primary)]" />
              What this connection unlocks
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: <Megaphone className="h-4 w-4 text-[var(--primary)]" />,
                  title: "Campaign launch",
                  copy: "Use connected pages and ad accounts while publishing paid campaigns.",
                },
                {
                  icon: <Layers3 className="h-4 w-4 text-[var(--primary)]" />,
                  title: "Asset mapping",
                  copy: "Keep pages, ad accounts, and tracking assets aligned per offer.",
                },
                {
                  icon: <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />,
                  title: "Safer reconnects",
                  copy: "Reconnect any time if access changes, then review each offer mapping.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/10">
                    {item.icon}
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-[var(--foreground)]">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <UserCircle2 className="h-4 w-4 text-[var(--primary)]" />
              Connection details
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Connected account
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {connectedUser?.meta_user_name || "No Meta account connected yet"}
                </div>
                <div className="mt-1 break-all text-sm text-[var(--muted-foreground)]">
                  {connectedUser?.meta_user_email || "Connect once and your linked assets will show up here."}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Setup flow
                </div>
                <ol className="mt-3 space-y-3 text-sm text-[var(--muted-foreground)]">
                  <li className="flex gap-3"><span className="font-semibold text-[var(--foreground)]">1.</span><span>Authorize your Meta business login.</span></li>
                  <li className="flex gap-3"><span className="font-semibold text-[var(--foreground)]">2.</span><span>Nettmark stores the pages and ad accounts tied to that login.</span></li>
                  <li className="flex gap-3"><span className="font-semibold text-[var(--foreground)]">3.</span><span>Attach those assets to each existing or new offer.</span></li>
                  <li className="flex gap-3"><span className="font-semibold text-[var(--foreground)]">4.</span><span>Install tracking after the offer exists, so it has something to attach to.</span></li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">Connected Meta assets</div>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {connected
                  ? "Your currently available pages and ad accounts."
                  : "Once you connect Meta, your linked pages and ad accounts will appear here."}
              </p>
            </div>
            {connected && (
              <div className="text-xs text-[var(--muted-foreground)]">
                {uniquePages.length} pages · {uniqueAdAccounts.length} ad accounts
              </div>
            )}
          </div>

          {loading ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--background)]/70 p-5"
                >
                  <div className="h-4 w-32 rounded bg-[var(--border)]" />
                  <div className="mt-4 h-10 rounded-xl bg-[var(--border)]" />
                  <div className="mt-3 h-24 rounded-2xl bg-[var(--border)]" />
                </div>
              ))}
            </div>
          ) : connected ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {uniquePages.map((connection) => {
                const accountMatches = uniqueAdAccounts.filter(
                  (account) => account.page_id === connection.page_id || account.ad_account_id === connection.ad_account_id,
                );

                return (
                  <article
                    key={connection.id}
                    className="rounded-3xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(0,194,203,0.08),transparent_48%)] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Facebook page
                        </div>
                        <h3 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                          {connection.page_name || "Untitled page"}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)] break-all">
                          Page ID: {connection.page_id || "—"}
                        </p>
                      </div>

                      <div className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                        Connected
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                        <Megaphone className="h-4 w-4 text-[var(--primary)]" />
                        Ad accounts
                      </div>

                      <div className="mt-4 space-y-3">
                        {(accountMatches.length ? accountMatches : [connection]).map((account, index) => (
                          <div
                            key={`${account.ad_account_id || connection.id}-${index}`}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-3"
                          >
                            <div className="text-sm font-semibold text-[var(--foreground)]">
                              {account.ad_account_name || "Unnamed ad account"}
                            </div>
                            <div className="mt-1 break-all text-xs text-[var(--muted-foreground)]">
                              {account.ad_account_id || "No ad account ID"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--background)]/60 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                <Link2 className="h-6 w-6 text-[var(--primary)]" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-[var(--foreground)]">
                No Meta assets connected yet
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted-foreground)]">
                Connect your Meta business once and this page will fill out with your pages and ad accounts instead of looking sad and empty.
              </p>
              <a
                href={oauthUrl}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_14px_35px_rgba(0,194,203,0.28)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Connect Meta
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ConnectMetaPage() {
  return (
    <Suspense fallback={null}>
      <ConnectMetaPageInner />
    </Suspense>
  );
}
