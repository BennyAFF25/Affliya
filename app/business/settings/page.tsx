"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import { supabase } from "utils/supabase/pages-client";
import toast from "react-hot-toast";

export default function BusinessSettingsPage() {
  const user = useUser();

  const [businessName, setBusinessName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [resetSending, setResetSending] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);


  useEffect(() => {
    if (!user?.email) return;

    const loadProfile = async () => {
      setLoadingProfile(true);

      const { data, error } = await (supabase as any)
        .from("business_profiles")
        .select("business_name, billing_email, avatar_url")
        .eq("business_email", user.email as string)
        .single();

      if (!error && data) {
        const row = data as any;
        setBusinessName(row.business_name ?? "");
        setBillingEmail(row.billing_email ?? "");
        setAvatarUrl(row.avatar_url ?? null);
      }

      setLoadingProfile(false);
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

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      setResetMsg(error.message);
      toast.error(error.message || "Failed to send reset link");
    } else {
      setResetMsg("Reset link sent. Check your email.");
      toast.success("Password reset link sent");
    }

    setResetSending(false);
  };

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

        <header className="space-y-2 relative">
          <h1 className="text-3xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[var(--primary)]/70 to-[var(--primary)]">
            Business settings
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your Nettmark business profile, contact details, and account security.
          </p>
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
