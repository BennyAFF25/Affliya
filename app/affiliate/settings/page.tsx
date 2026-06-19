"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode, ChangeEvent } from "react";
import Script from "next/script";
import { useUser } from "@supabase/auth-helpers-react";
import { Sparkles } from "lucide-react";
import { supabase } from "utils/supabase/pages-client";
import toast from "react-hot-toast";

type CheckResp = {
  error?: string;
  hasAccount: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
  accountId?: string;
};

const CARD_SHELL =
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_25px_70px_rgba(0,0,0,0.08)]";
const PANEL_CARD =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_20px_55px_rgba(0,0,0,0.06)]";
const INPUT_CLASS =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

export default function AffiliateSettingsPage() {
  const user = useUser();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<CheckResp | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [resetSending, setResetSending] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [payoutConnectNotice, setPayoutConnectNotice] = useState<string | null>(null);


  async function refreshStatus() {
    try {
      if (!user?.id && !user?.email) {
        // Don't call the API until we have a session
        return;
      }

      setChecking(true);

      const qs = user?.id
        ? `?user_id=${encodeURIComponent(user.id)}`
        : `?email=${encodeURIComponent(user!.email!)}`;

      const res = await fetch(`/api/stripe/affiliates/check-account${qs}`, {
        cache: "no-store",
      });
      const json: CheckResp = await res.json();

      if (!res.ok)
        throw new Error(json.error || `Status check failed (${res.status})`);
      if (json.error) throw new Error(json.error);

      setStatus(json);
    } catch (err: any) {
      toast.error(err.message || "Failed to check status");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

  useEffect(() => {
    const loadPayoutNotice = async () => {
      if (!user?.email) return;
      if (status?.payoutsEnabled) {
        setPayoutConnectNotice(null);
        return;
      }
      const { data, error } = await (supabase as any)
        .from("wallet_payouts")
        .select("created_at, available_at, status")
        .eq("affiliate_email", user.email)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1);

      if (error || !data?.length) {
        setPayoutConnectNotice(null);
        return;
      }

      const row = data[0];
      const fallbackAvailable = new Date(row.created_at || Date.now());
      fallbackAvailable.setDate(fallbackAvailable.getDate() + 14);
      const availableAt = row.available_at ? new Date(row.available_at) : fallbackAvailable;

      setPayoutConnectNotice(
        `You have pending payout(s). Connect Stripe by ${availableAt.toLocaleDateString()} to receive withdrawal release on time.`,
      );
    };

    void loadPayoutNotice();
  }, [user?.email, status?.payoutsEnabled]);

  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      setLoadingProfile(true);

      // Fetch affiliate profile info as before
      const { data: affiliateData, error: affiliateError } = await (
        supabase as any
      )
        .from("affiliate_profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (!affiliateError && affiliateData) {
        setDisplayName((affiliateData as any).display_name ?? "");
        setAvatarUrl((affiliateData as any).avatar_url ?? null);
      }

      setLoadingProfile(false);
    };

    void loadProfile();
  }, [user]);

  async function startOnboarding() {
    try {
      if (!user?.id || !user?.email) {
        toast.error("Missing user session. Please re-login.");
        return;
      }

      setLoading(true);

      const res = await fetch("/api/stripe/affiliates/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          stripe_account_id: status?.accountId || null,
          role: "affiliate",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to start onboarding");
      if (json.error) throw new Error(json.error);
      if (!json.url) throw new Error("Stripe onboarding URL missing");

      window.location.href = json.url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start onboarding");
    } finally {
      setLoading(false);
    }
  }

  async function resumeOnboarding() {
    return startOnboarding();
  }

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email || !user?.id) return;

    setSavingProfile(true);

    const { error } = await (supabase as any).from("affiliate_profiles").upsert(
      {
        user_id: user.id,
        email: user.email as string,
        display_name: displayName,
      } as any,
      { onConflict: "user_id" },
    );

    if (error) {
      // Most common cause here is RLS blocking inserts/updates if user_id/email aren't set correctly
      toast.error(error.message || "Failed to save profile");
    } else {
      toast.success("Profile updated");
    }

    setSavingProfile(false);
  };

  const handleSendReset = async () => {
    if (!user?.email) return;

    setResetSending(true);
    setResetMsg(null);

    try {
      await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });

      setResetMsg("Reset link sent. Check your email.");
      toast.success("Password reset link sent");
    } catch (error) {
      console.error('[affiliate settings] reset request failed', error);
      setResetMsg("Failed to send reset link. Please try again.");
      toast.error("Failed to send reset link");
    }

    setResetSending(false);
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploadingAvatar(true);

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/affiliate-avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await (supabase as any).storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        toast.error(uploadError.message || "Failed to upload image");
        return;
      }

      const { data } = (supabase as any).storage
        .from("avatars")
        .getPublicUrl(filePath);
      const publicUrl = (data as any)?.publicUrl as string | undefined;

      if (!publicUrl) {
        toast.error("Could not get image URL");
        return;
      }

      const { error: updateError } = await (supabase as any)
        .from("affiliate_profiles")
        .upsert(
          {
            user_id: user.id,
            email: user.email as string,
            avatar_url: publicUrl,
          } as any,
          { onConflict: "user_id" },
        );

      if (updateError) {
        console.error(updateError);
        toast.error(updateError.message || "Failed to save avatar");
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success("Profile photo updated");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const initials = displayName?.trim()
    ? displayName
        .trim()
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0] || "N").toUpperCase();

  const CARD_SHELL =
    "rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_25px_70px_rgba(0,0,0,0.08)]";
  const INPUT_CLASS =
    "w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

  const Badge = ({
    children,
    tone = "default",
  }: {
    children: ReactNode;
    tone?: "ok" | "warn" | "bad" | "default";
  }) => {
    const map: any = {
      ok: "text-[#7ff5fb] border-[#00C2CB40] bg-white/5 shadow-[0_0_20px_#00C2CB40]",
      warn: "text-amber-300 border-amber-500/30 bg-white/5",
      bad: "text-rose-300 border-rose-500/30 bg-white/5",
      default: "text-white/70 border-white/10 bg-white/[0.04]",
    };
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${map[tone]}`}
      >
        {children}
      </span>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      <div className="relative max-w-4xl mx-auto px-6 py-10 space-y-10">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 blur-3xl"
          style={{
            background:
              "radial-gradient(40% 60% at 50% 20%, rgba(0,194,203,0.18), rgba(0,0,0,0) 60%)",
          }}
        />

        <header className={`${CARD_SHELL} px-6 py-8`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Affiliate Settings
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted-foreground)] sm:text-base">
                Manage your account profile, payout setup, and withdrawal
                details from one place.
              </p>
              <p className="mt-2 max-w-2xl text-xs text-[var(--muted-foreground)] sm:text-sm">
                No need to connect Stripe until you’ve made your first sale.
              </p>
            </div>
          </div>

          {payoutConnectNotice ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {payoutConnectNotice}
            </div>
          ) : null}

          <details className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:content-none">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Stuck? View the full affiliate settings demo
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
                  Open a step-by-step walkthrough for payouts, profile setup, and the full affiliate-side flow.
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C2CB] transition group-open:rotate-45">
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
                  paddingBottom: "calc(65.41% + 25px)",
                  height: 0,
                  transform: "scale(1)",
                }}
              >
                <iframe
                  title="Affiliate settings walkthrough"
                  loading="lazy"
                  className="sl-demo absolute left-0 top-0 h-full w-full"
                  src="https://app.storylane.io/demo/jlqa5l5cdbbe?embed=inline"
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
        </header>


        {user && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.12)]">
            <h2 className="text-sm font-semibold text-[#00C2CB] mb-4">
              Profile
            </h2>

            {loadingProfile ? (
              <p className="text-xs text-white/70">Loading profile…</p>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Affiliate avatar"
                        className="h-16 w-16 rounded-full object-cover border border-white/20"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#00C2CB] to-[#7ff5fb] flex items-center justify-center text-lg font-medium text-black shadow-[0_0_30px_rgba(0,194,203,0.4)]">
                        {initials}
                      </div>
                    )}

                    {uploadingAvatar && (
                      <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-[10px] text-white/80">
                        Uploading…
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-white/80">Profile photo</p>
                    <p className="text-[11px] text-white/60">
                      This will appear in your dashboard and on campaigns.
                    </p>

                    <label className="inline-flex items-center rounded-full border border-[#00C2CB]/40 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-[#00C2CB] hover:bg-[#00C2CB]/10 cursor-pointer">
                      {uploadingAvatar ? "Uploading…" : "Change photo"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                    </label>
                  </div>
                </div>

                <hr className="border-white/10" />

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">
                    Email
                  </label>
                  <input
                    disabled
                    value={user.email ?? ""}
                    className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white/70 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">
                    Display name
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
                    placeholder="e.g. Ben • Paid Ads"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center rounded-full bg-[#00C2CB] px-4 py-2 text-xs font-medium text-black hover:bg-[#00b0b8] disabled:opacity-60"
                >
                  {savingProfile ? "Saving…" : "Save changes"}
                </button>
              </form>
            )}
          </section>
        )}

        {user && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.12)]">
            <h2 className="text-sm font-semibold text-[#00C2CB] mb-3">
              Password
            </h2>
            <p className="text-xs text-white/70 mb-4">
              We&apos;ll email you a secure link to set a new password for your
              Nettmark account.
            </p>
            <button
              type="button"
              onClick={handleSendReset}
              disabled={resetSending}
              className="inline-flex items-center rounded-full border border-[#00C2CB]/40 bg-white/5 px-4 py-2 text-xs font-medium text-[#00C2CB] hover:bg-[#00C2CB]/10 disabled:opacity-60"
            >
              {resetSending
                ? "Sending reset link…"
                : "Send reset password link"}
            </button>
            {resetMsg && (
              <p className="mt-3 text-[11px] text-white/70">{resetMsg}</p>
            )}
          </section>
        )}


        {/* Withdrawals (Connect) */}
        <section
          id="withdrawals"
          className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.15)] scroll-mt-24"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-white">
                Withdrawals{" "}
                <span className="text-white/70">(Stripe Connect)</span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Nettmark uses Stripe Express to send affiliate payouts. Stripe
                may first show a <span className="text-white font-medium">Sign in to Express</span>{" "}
                screen — that is expected, even if you have never used Stripe
                before.
              </p>
            </div>

            <button
              onClick={refreshStatus}
              disabled={checking}
              className="rounded-full border border-[#00C2CB40] px-3 py-1 text-sm text-white/80 hover:bg-white/5 shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition"
            >
              {checking ? "Checking…" : "Refresh"}
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[#00C2CB40] bg-[#00C2CB14] px-4 py-3 text-sm text-white/80 shadow-[0_0_20px_rgba(0,194,203,0.12)]">
              <p className="font-medium text-white">What to expect from Stripe</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-white/70">
                <li>Click the button below to open Stripe Express in a new step.</li>
                <li>Stripe may ask for your email first before continuing onboarding.</li>
                <li>You do not need to already have a Stripe account set up for this to work.</li>
                <li>Use the same email you want payouts connected to, then follow Stripe&apos;s prompts.</li>
              </ul>
            </div>
            {status ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={status.hasAccount ? "ok" : "default"}>
                    {status.hasAccount ? "Account created" : "No account yet"}
                  </Badge>
                  <Badge
                    tone={
                      status.onboardingComplete
                        ? "ok"
                        : status.hasAccount
                          ? "warn"
                          : "default"
                    }
                  >
                    {status.onboardingComplete
                      ? "Onboarding complete"
                      : status.hasAccount
                        ? "Action required"
                        : "Not started"}
                  </Badge>
                  <Badge tone={status.payoutsEnabled ? "ok" : "warn"}>
                    {status.payoutsEnabled
                      ? "Payouts enabled"
                      : "Payouts not enabled"}
                  </Badge>
                  {status.accountId && <Badge>acct: {status.accountId}</Badge>}
                </div>

                {!status.hasAccount && (
                  <button
                    onClick={startOnboarding}
                    disabled={loading}
                    className="rounded-full bg-[#00C2CB] px-5 py-2 text-black hover:bg-[#00b0b8] shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition"
                  >
                    {loading ? "Opening Stripe…" : "Set up Stripe payouts"}
                  </button>
                )}

                {status.hasAccount && !status.onboardingComplete && (
                  <div className="space-y-2">
                    {!!status.requirementsDue?.length && (
                      <p className="text-sm text-amber-300">
                        Stripe needs: {status.requirementsDue.join(", ")}
                      </p>
                    )}
                    {status.disabledReason && (
                      <p className="text-sm text-rose-300">
                        Reason: {status.disabledReason}
                      </p>
                    )}

                    <button
                      onClick={resumeOnboarding}
                      disabled={loading}
                      className="rounded-full bg-[#00C2CB] px-5 py-2 text-black hover:bg-[#00b0b8] shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition"
                    >
                      {loading ? "Opening Stripe…" : "Continue Stripe setup"}
                    </button>
                  </div>
                )}

                {status.onboardingComplete && (
                  <div className="text-sm text-white/70">
                    Your bank details are connected. You can withdraw from the{" "}
                    <span className="text-[#7ff5fb] font-medium">Wallet</span>{" "}
                    page.
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-white/70">Loading…</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.15)]">
          <h3 className="text-base font-medium mb-2 text-white">
            Where to withdraw/top-up?
          </h3>
          <p className="text-sm text-white/70">
            • Top-ups and withdrawals live on the{" "}
            <span className="text-[#7ff5fb]">Wallet</span> page.
            <br />• This settings page is only for connecting or fixing your
            bank info.
          </p>
        </section>
      </div>
    </div>
  );
}
