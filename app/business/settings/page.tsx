'use client';

import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import toast from 'react-hot-toast';

export default function BusinessSettingsPage() {
  const user = useUser();

  const [businessName, setBusinessName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [resetSending, setResetSending] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [openingPortal, setOpeningPortal] = useState(false);

  const [trialInfo, setTrialInfo] = useState<{ status: string | null; periodEnd: string | null } | null>(null);

  const handleManageSubscription = async () => {
    if (!user?.email) return;

    try {
      setOpeningPortal(true);

      const res = await fetch('/api/stripe-app/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: 'business',
          userId: user.id,
          email: user.email,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = (json as any)?.error || 'Failed to open billing portal';
        throw new Error(msg);
      }

      const url = (json as any)?.url as string | undefined;
      if (!url) throw new Error('Missing portal URL');

      window.location.href = url;
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to open billing portal');
    } finally {
      setOpeningPortal(false);
    }
  };

  useEffect(() => {
    if (!user?.email) return;

    const loadProfile = async () => {
      setLoadingProfile(true);

      const { data, error } = await (supabase as any)
        .from('business_profiles')
        .select('business_name, billing_email, avatar_url')
        .eq('business_email', user.email as string)
        .single();

      if (!error && data) {
        const row = data as any;
        setBusinessName(row.business_name ?? '');
        setBillingEmail(row.billing_email ?? '');
        setAvatarUrl(row.avatar_url ?? null);
      }

      // New query for trial info
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('revenue_subscription_status, revenue_current_period_end')
        .eq('id', user.id)
        .single();

      if (!profileError && profileData) {
        setTrialInfo({
          status: profileData.revenue_subscription_status ?? null,
          periodEnd: profileData.revenue_current_period_end ?? null,
        });
      } else {
        setTrialInfo(null);
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

      const fileExt =
        file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/business-avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await (supabase as any)
        .storage.from('avatars')
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        toast.error(uploadError.message || 'Failed to upload image');
        return;
      }

      const { data } = (supabase as any)
        .storage.from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = (data as any)?.publicUrl as string | undefined;
      if (!publicUrl) {
        toast.error('Could not get image URL');
        return;
      }

      const { error: updateError } = await (supabase as any)
        .from('business_profiles')
        .upsert(
          {
            business_email: user.email as string,
            avatar_url: publicUrl,
          },
          { onConflict: 'business_email' }
        );

      if (updateError) {
        console.error(updateError);
        toast.error(updateError.message || 'Failed to save avatar');
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success('Profile photo updated');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      // reset file input
      e.target.value = '';
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
      .from('business_profiles')
      .upsert(payload, { onConflict: 'business_email' });

    if (error) {
      toast.error(error.message || 'Failed to save business profile');
    } else {
      toast.success('Business profile updated');
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
      toast.error(error.message || 'Failed to send reset link');
    } else {
      setResetMsg('Reset link sent. Check your email.');
      toast.success('Password reset link sent');
    }

    setResetSending(false);
  };

  const initials =
    businessName?.trim()
      ? businessName
          .trim()
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : (user?.email?.[0] || 'N').toUpperCase();

  return (
    <div className="min-h-screen w-full bg-surface">
      <div className="relative max-w-4xl mx-auto px-6 py-10 space-y-10 text-white">
        {/* Teal glow accent */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 blur-3xl"
          style={{
            background:
              'radial-gradient(40% 60% at 50% 20%, rgba(0,194,203,0.22), rgba(0,0,0,0) 60%)',
          }}
        />

        <header className="space-y-2 relative">
          <h1 className="text-3xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#7ff5fb] to-[#00C2CB]">
            Business settings
          </h1>
          <p className="text-sm text-white/70">
            Manage your Nettmark business profile and account security.
          </p>
        </header>

        {trialInfo?.status === 'trialing' && trialInfo.periodEnd && (() => {
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (new Date(trialInfo.periodEnd).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          );
          const formattedDate = new Date(trialInfo.periodEnd).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          return (
            <section className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.12)]">
              <h2 className="text-sm font-semibold text-[#00C2CB] mb-2">Free Trial Active</h2>
              <p className="text-xs text-white/70 mb-1">
                Your free trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''} ({formattedDate}).
              </p>
              <p className="text-[11px] text-white/60">
                Add a payment method before your trial ends to avoid interruption.
              </p>
            </section>
          );
        })()}

        {!user && (
          <p className="text-sm text-white/70 relative">
            Please sign in to manage your business settings.
          </p>
        )}

        {user && (
          <section className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.12)]">
            <h2 className="text-sm font-semibold text-[#00C2CB] mb-4">
              Business profile
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
                        alt="Business avatar"
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
                      This will appear in your dashboard and for affiliates.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center rounded-full border border-[#00C2CB]/40 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-[#00C2CB] hover:bg-[#00C2CB]/10 cursor-pointer">
                        {uploadingAvatar ? 'Uploading…' : 'Change photo'}
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

                <hr className="border-white/10" />

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">
                    Account email
                  </label>
                  <input
                    disabled
                    value={user.email ?? ''}
                    className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white/70 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">
                    Business name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
                    placeholder="e.g. Bennys Burgers Pty Ltd"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">
                    Billing email
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
                    placeholder="Where invoices and receipts should be sent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center rounded-full bg-[#00C2CB] px-4 py-2 text-xs font-medium text-black hover:bg-[#00b0b8] disabled:opacity-60"
                >
                  {savingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            )}
          </section>
        )}

        {user && (
          <section className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.12)]">
            <h2 className="text-sm font-semibold text-[#00C2CB] mb-3">
              Password
            </h2>
            <p className="text-xs text-white/70 mb-4">
              We&apos;ll email you a secure link to set a new password for your Nettmark business login.
            </p>
            <button
              type="button"
              onClick={handleSendReset}
              disabled={resetSending}
              className="inline-flex items-center rounded-full border border-[#00C2CB]/40 bg-white/5 px-4 py-2 text-xs font-medium text-[#00C2CB] hover:bg-[#00C2CB]/10 disabled:opacity-60"
            >
              {resetSending ? 'Sending reset link…' : 'Send reset password link'}
            </button>
            {resetMsg && (
              <p className="mt-3 text-[11px] text-white/70">
                {resetMsg}
              </p>
            )}
          </section>
        )}

        {user && (
          <section className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.12)]">
            <h2 className="text-sm font-semibold text-[#00C2CB] mb-3">Billing</h2>
            <p className="text-xs text-white/70 mb-4">
              Manage your Nettmark business subscription, update payment method, and view invoices.
            </p>

            <button
              type="button"
              onClick={handleManageSubscription}
              disabled={openingPortal}
              className="inline-flex items-center rounded-full bg-[#00C2CB] px-4 py-2 text-xs font-medium text-black hover:bg-[#00b0b8] disabled:opacity-60"
            >
              {openingPortal ? 'Opening billing…' : 'Manage subscription'}
            </button>

            <p className="mt-3 text-[11px] text-white/50">
              You’ll be redirected to Stripe’s secure customer portal.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}