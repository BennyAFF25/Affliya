"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import { Sparkles } from "lucide-react";
import { supabase } from "utils/supabase/pages-client";
import toast from "react-hot-toast";

type SubscriptionState = {
  status: string | null;
  currentPeriodEnd: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  isGrandfathered: boolean;
  subscriptionRequired: boolean;
};

function formatSubscriptionStatus(status: string | null) {
  const normalized = String(status || "").toLowerCase();

  if (!normalized) return "Not started";
  if (normalized === "grandfathered") return "Grandfathered";
  if (normalized === "trialing" || normalized === "subscription_trialing") return "Trial active";
  if (normalized === "active" || normalized === "subscription_active") return "Active";
  if (normalized === "past_due" || normalized === "subscription_past_due") return "Past due";
  if (normalized === "canceled" || normalized === "cancelled" || normalized === "subscription_cancelled") return "Canceled";
  if (normalized === "incomplete" || normalized === "subscription_incomplete") return "Incomplete";
  if (normalized === "subscription_required") return "Subscription required";

  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSubscriptionDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BusinessSettingsPage() {
  const user = useUser();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [resetSending, setResetSending] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    status: null,
    currentPeriodEnd: null,
    subscriptionId: null,
    customerId: null,
    isGrandfathered: false,
    subscriptionRequired: false,
  });

  useEffect(() => {
    if (!user?.email) return;

    const loadProfile = async () => {
      setLoadingProfile(true);
      setLoadingSubscription(true);

      const { data, error } = await (supabase as any)
        .from("business_profiles")
        .select("id, business_name, billing_email, avatar_url")
        .eq("business_email", user.email as string)
        .single();

      const profileRow = !error && data ? (data as any) : null;
      const resolvedBusinessId = profileRow?.id ?? null;
      setBusinessId(resolvedBusinessId);

      if (profileRow) {
        setBusinessName(profileRow.business_name ?? "");
        setBillingEmail(profileRow.billing_email ?? "");
        setAvatarUrl(profileRow.avatar_url ?? null);
      }

      if (resolvedBusinessId) {
        const { data: entitlementData, error: entitlementError } = await (supabase as any)
          .from("business_entitlements")
          .select(
            "billing_status, is_grandfathered, subscription_required, subscription_current_period_end, stripe_subscription_id, subscription_stripe_customer_id",
          )
          .eq("business_id", resolvedBusinessId)
          .maybeSingle();

        if (!entitlementError && entitlementData) {
          const row = entitlementData as any;
          setSubscription({
            status: row.is_grandfathered ? "grandfathered" : row.billing_status ?? null,
            currentPeriodEnd: row.subscription_current_period_end ?? null,
            subscriptionId: row.stripe_subscription_id ?? null,
            customerId: row.subscription_stripe_customer_id ?? null,
            isGrandfathered: Boolean(row.is_grandfathered),
            subscriptionRequired: Boolean(row.subscription_required),
          });
        } else {
          setSubscription({
            status: null,
            currentPeriodEnd: null,
            subscriptionId: null,
            customerId: null,
            isGrandfathered: false,
            subscriptionRequired: false,
          });
        }
      } else {
        setSubscription({
          status: null,
          currentPeriodEnd: null,
          subscriptionId: null,
          customerId: null,
          isGrandfathered: false,
          subscriptionRequired: false,
        });
      }

      setLoadingProfile(false);
      setLoadingSubscription(false);
    };

    void loadProfile();
  }, [user]);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploadingAvatar(true);

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/business-avatar-${Date.now()}.${fileExt}`;

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
        .from("business_profiles")
        .upsert(
          {
            business_email: user.email as string,
            avatar_url: publicUrl,
          },
          { onConflict: "business_email" },
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
      // reset file input
      e.target.value = "";
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    setSavingProfile(true);

    const payload = {
      business_email: user.email as string,
      business_name: businessName || null,
      billing_email: billingEmail || null,
    };

    const { error } = await (supabase as any)
      .from("business_profiles")
      .upsert(payload, { onConflict: "business_email" });

    if (error) {
      toast.error(error.message || "Failed to save business profile");
    } else {
      toast.success("Business profile updated");
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
      console.error('[business settings] reset request failed', error);
      setResetMsg("Failed to send reset link. Please try again.");
      toast.error("Failed to send reset link");
    }

    setResetSending(false);
  };

  const handleManageSubscription = async () => {
    if (!user?.email || !businessId) return;

    try {
      setManagingSubscription(true);

      const res = await fetch("/api/business-subscription/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || "Failed to open billing portal");
      }

      if (!json.url) {
        throw new Error("Stripe billing portal URL missing");
      }

      window.location.href = json.url;
    } catch (err: any) {
      toast.error(err.message || "Failed to open billing portal");
    } finally {
      setManagingSubscription(false);
    }
  };

  const subscriptionStatusLabel = formatSubscriptionStatus(subscription.status);
  const subscriptionDateLabel = formatSubscriptionDate(subscription.currentPeriodEnd);
  const hasPortalAccess = !subscription.isGrandfathered && (!!subscription.customerId || !!subscription.subscriptionId);

  const initials = businessName?.trim()
    ? businessName
        .trim()
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0] || "N").toUpperCase();

  return (
    <div className="min-h-screen w-full bg-[var(--background)]">
      <div className="relative mx-auto max-w-4xl space-y-10 px-6 py-10 text-[var(--foreground)]">
        {/* Teal glow accent */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 blur-3xl"
          style={{
            background:
              "radial-gradient(40% 60% at 50% 20%, rgba(0,194,203,0.22), rgba(0,0,0,0) 60%)",
          }}
        />

        <header className="relative rounded-3xl border border-[var(--border)] bg-[var(--card)] px-6 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Business Settings
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted-foreground)] sm:text-base">
                Manage your Nettmark business profile, billing contact details,
                and account security from one place.
              </p>
            </div>
          </div>
        </header>

        {!user && (
          <p className="text-sm text-[var(--muted-foreground)] relative">
            Please sign in to manage your business settings.
          </p>
        )}

        {user && (
          <section className="relative rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_0_60px_0_rgba(0,0,0,0.10)]">
            <h2 className="mb-4 text-sm font-semibold text-[var(--primary)]">
              Business profile
            </h2>

            {loadingProfile ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                Loading profile…
              </p>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Business avatar"
                        className="h-16 w-16 rounded-full object-cover border border-[var(--border)]"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-[var(--primary)]/15 flex items-center justify-center text-lg font-medium text-[var(--primary)] shadow-[0_0_30px_rgba(0,194,203,0.4)]">
                        {initials}
                      </div>
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 rounded-full bg-[var(--card)]/80 flex items-center justify-center text-[10px] text-[var(--muted-foreground)]">
                        Uploading…
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--foreground)]/85">
                      Profile photo
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      This will appear in your dashboard and for affiliates.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center cursor-pointer rounded-full border border-[var(--primary)]/40 bg-[var(--card)] px-3 py-1.5 text-[11px] font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10">
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
                </div>

                <hr className="border-[var(--border)]" />

                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1">
                    Account email
                  </label>
                  <input
                    disabled
                    value={user.email ?? ""}
                    className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-[var(--muted-foreground)] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1">
                    Business name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    placeholder="e.g. Bennys Burgers Pty Ltd"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1">
                    Billing email
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    placeholder="Where invoices and receipts should be sent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] hover:brightness-110 disabled:opacity-60"
                >
                  {savingProfile ? "Saving…" : "Save changes"}
                </button>
              </form>
            )}
          </section>
        )}

        {user && (
          <section className="relative rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_0_60px_0_rgba(0,0,0,0.10)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="mb-2 text-sm font-semibold text-[var(--primary)]">
                  Subscription & billing
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Manage the $49/month Nettmark Business subscription, invoices,
                  payment method, and cancellation from the Stripe billing portal.
                </p>
              </div>

              <span className="inline-flex w-fit items-center rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-3 py-1 text-[11px] font-medium text-[var(--primary)]">
                {loadingSubscription ? "Checking…" : subscriptionStatusLabel}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--background)]/50 p-4">
              {loadingSubscription ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Loading subscription status…
                </p>
              ) : (
                <>
                  <p className="text-sm text-[var(--foreground)]">
                    {subscription.isGrandfathered
                      ? "This existing business is grandfathered and does not need the $49/month Nettmark Business subscription."
                      : subscription.status === "subscription_trialing" || subscription.status === "trialing"
                        ? `Trial ends ${subscriptionDateLabel ?? "soon"}.`
                        : subscription.status === "subscription_active" || subscription.status === "active"
                          ? `Your $49/month Nettmark Business subscription renews ${subscriptionDateLabel ?? "automatically"}.`
                          : subscription.status === "subscription_cancelled" || subscription.status === "canceled"
                            ? "This Nettmark Business subscription has been canceled."
                            : hasPortalAccess
                              ? "Open the billing portal to manage this Nettmark Business subscription."
                              : subscription.subscriptionRequired
                                ? "A Nettmark Business subscription is required before this business can approve or launch paid affiliate campaign activity. Complete checkout from the approval flow, then come back here to manage it."
                                : "No Nettmark Business subscription is linked yet. You can keep creating offers and reviewing activity; checkout appears when a paid campaign approval or launch requires it."}
                  </p>

                  <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                    Trial cancellations and payment-method changes happen in Stripe so billing stays clean and self-serve.
                  </p>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={managingSubscription || loadingSubscription || !hasPortalAccess}
                className="inline-flex items-center rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] hover:brightness-110 disabled:opacity-60"
              >
                {managingSubscription
                  ? "Opening portal…"
                  : subscription.status === "trialing"
                    ? "Manage or cancel trial"
                    : "Manage subscription"}
              </button>

              {!hasPortalAccess && !loadingSubscription ? (
                <span className="inline-flex items-center rounded-full border border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                  Available after the first subscription checkout
                </span>
              ) : null}
            </div>
          </section>
        )}

        {user && (
          <section className="relative rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_0_60px_0_rgba(0,0,0,0.10)]">
            <h2 className="mb-3 text-sm font-semibold text-[var(--primary)]">
              Password
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              We&apos;ll email you a secure link to set a new password for your
              Nettmark business login.
            </p>
            <button
              type="button"
              onClick={handleSendReset}
              disabled={resetSending}
              className="inline-flex items-center rounded-full border border-[var(--primary)]/40 bg-[var(--card)] px-4 py-2 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-60"
            >
              {resetSending
                ? "Sending reset link…"
                : "Send reset password link"}
            </button>
            {resetMsg && (
              <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                {resetMsg}
              </p>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
