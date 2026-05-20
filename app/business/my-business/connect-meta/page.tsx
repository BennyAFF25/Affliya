"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";
import {
  ArrowRight,
  BadgeCheck,
  Layers3,
  Link2,
  Megaphone,
  RefreshCcw,
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
};

const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=https://www.nettmark.com/api/meta/callback&scope=pages_show_list,ads_management,business_management,pages_read_engagement,pages_read_user_content,ads_read,pages_manage_ads&response_type=code`;

function uniqBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
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

export default function ConnectMetaPage() {
  const searchParams = useSearchParams();
  const session = useSession();
  const user = session?.user;

  const [connections, setConnections] = useState<MetaConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    const loadConnections = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("meta_connections")
        .select(
          `
          id,
          meta_user_name,
          meta_user_email,
          ad_account_id,
          ad_account_name,
          page_id,
          page_name
        `,
        )
        .eq("business_email", user.email as string)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("❌ Failed to load Meta connections:", error);
        setConnections([]);
      } else {
        setConnections((data || []) as MetaConnection[]);
      }

      setLoading(false);
    };

    loadConnections();
  }, [user?.email]);

  const connected = connections.length > 0;
  const isOnboard = searchParams?.get("onboard") === "1";

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
                  Connect Meta before offer creation
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
                  This keeps the onboarding path clean: connect Meta first, then create the offer with the exact page and ad account you want attached, then move into tracking once the offer exists.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/business/my-business"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--background)]"
                >
                  Back to onboarding
                </Link>
                <Link
                  href="/business/my-business/create-offer?onboard=1"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                >
                  Continue to create offer
                </Link>
              </div>
            </div>
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
                  Link your Meta login, pages, and ad accounts so Nettmark can keep offers,
                  creatives, and campaign launches in sync.
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
                {isOnboard ? (
                  <Link
                    href="/business/my-business/create-offer?onboard=1"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-5 py-3 text-sm font-semibold text-[var(--foreground)] backdrop-blur transition hover:bg-[var(--card)]"
                  >
                    Continue to create offer
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <a
                    href="/business/setup-tracking"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-5 py-3 text-sm font-semibold text-[var(--foreground)] backdrop-blur transition hover:bg-[var(--card)]"
                  >
                    Setup tracking
                    <ArrowRight className="h-4 w-4" />
                  </a>
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
                <div className="text-xs font-medium text-[var(--muted-foreground)]">Status</div>
                <div className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {connected ? "Ready to launch" : "Awaiting setup"}
                </div>
              </div>
            </div>
          </div>
        </section>

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
                  copy: "Use connected pages and ad accounts while creating and publishing offers.",
                },
                {
                  icon: <Layers3 className="h-4 w-4 text-[var(--primary)]" />,
                  title: "Asset mapping",
                  copy: "Keep your pages, ad accounts, and later tracking assets aligned per offer.",
                },
                {
                  icon: <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />,
                  title: "Safer reconnects",
                  copy: "Reconnect any time if access changes, without losing the overall workflow.",
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
                  <li className="flex gap-3"><span className="font-semibold text-[var(--foreground)]">3.</span><span>Pick those assets from the dropdown while creating each offer.</span></li>
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
