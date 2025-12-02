"use client";

import { useRouter } from "next/navigation";
import { useSession } from '@supabase/auth-helpers-react';
import { useState, useEffect } from "react";
import { supabase } from "@/../utils/supabase/pages-client";

export default function ConnectMetaPage() {
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const [metaConnection, setMetaConnection] = useState<any | null>(null);
  const [pageName, setPageName] = useState<string | null>(null);


  useEffect(() => {
    const fetchMetaConnection = async () => {
      const { data, error } = await supabase
        .from('meta_connections')
        .select('*')
        .eq('business_email', user?.email)
        .limit(1);

      if (error) {
        console.error('❌ Failed to load Meta connection:', error);
      } else if (data && data.length > 0) {
        setMetaConnection(data[0]);
        try {
          const pageRes = await fetch(`https://graph.facebook.com/v19.0/${data[0].page_id}?fields=name&access_token=${data[0].access_token}`);
          const pageData = await pageRes.json();
          if (pageData.name) {
            setPageName(pageData.name);
          }
        } catch (e) {
          console.error("❌ Failed to fetch page name from Meta:", e);
        }
      }
    };

    if (user) fetchMetaConnection();
  }, [user]);


  return (
    <div className="min-h-screen bg-[#050708] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-[#00C2CB]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13.828 21a4 4 0 01-5.656 0l-5.657-5.657a4 4 0 010-5.656l5.657-5.657a4 4 0 015.656 0l5.657 5.657a4 4 0 010 5.656L13.828 21z"
              />
            </svg>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#00C2CB]">
                Connect Meta Ads
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Link your Meta Business Manager so Nettmark can launch and track campaigns on your behalf.
              </p>
            </div>
          </div>

          {/* Connection status pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1f2a2b] bg-[#0e1112] px-3 py-1.5 text-[11px] text-white/70">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                metaConnection ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" : "bg-[#f97316]"
              }`}
            />
            <span className="font-medium">
              {metaConnection ? "Meta connected" : "Meta not connected"}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
          {/* Connect card */}
          <div className="bg-[#101213] border border-[#00C2CB]/30 rounded-2xl shadow-md shadow-[#00C2CB]/10 p-7 sm:p-8">
            <div className="space-y-5">
              <p className="text-xs sm:text-sm text-gray-300">
                We never take over your ad account — you stay in full control while Nettmark handles the heavy lifting:
                approvals, tracking, and affiliate flows.
              </p>

              <ul className="space-y-2 text-xs sm:text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
                  <span>Connect your Page, Ad Account, and access token securely via Meta&apos;s official OAuth flow.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
                  <span>Use your existing ad assets while Nettmark tracks affiliate performance in the background.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
                  <span>Disconnect or rotate access at any time directly from your Meta Business Manager.</span>
                </li>
              </ul>

              <div className="pt-2">
                <a
                  href={`https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=https://www.nettmark.com/api/meta/callback&scope=pages_show_list,ads_management,business_management,pages_read_engagement,pages_read_user_content,ads_read,pages_manage_ads&response_type=code`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#00C2CB] px-6 py-2.5 text-sm font-semibold text-black shadow transition hover:bg-[#00b0b8] hover:shadow-[0_0_18px_rgba(0,194,203,0.6)]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2.003 9.25C2.003 5.53 5.533 2 9.253 2s7.25 3.53 7.25 7.25-3.53 7.25-7.25 7.25A7.252 7.252 0 012.003 9.25zm7.25-3.75a.75.75 0 00-1.5 0v2.25H5.503a.75.75 0 000 1.5H7.75v2.25a.75.75 0 001.5 0v-2.25h2.25a.75.75 0 000-1.5H9.253V5.5z" />
                  </svg>
                  {metaConnection ? "Reconnect Meta" : "Connect My Meta Account"}
                </a>
                <p className="mt-2 text-[11px] text-gray-500">
                  You&apos;ll be redirected to Facebook to authorise Nettmark. We never see your Meta password.
                </p>
              </div>
            </div>
          </div>

          {/* Right column: either connection details or explainer */}
          {metaConnection ? (
            <div className="bg-[#101213] border border-[#00C2CB]/20 rounded-2xl p-6 sm:p-7 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-[#00C2CB] font-semibold mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.828 21a4 4 0 01-5.656 0l-5.657-5.657a4 4 0 010-5.656l5.657-5.657a4 4 0 015.656 0l5.657 5.657a4 4 0 010 5.656L13.828 21z"
                  />
                </svg>
                <span>Connected Meta account</span>
              </div>
              <div className="space-y-2 text-xs sm:text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-[#00C2CB]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5.121 17.804A3 3 0 017 17h10a3 3 0 012.121.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>
                    User: {metaConnection.meta_user_name} ({metaConnection.meta_user_email})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-[#00C2CB]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 9V7a4 4 0 00-8 0v2m0 0v6m0-6h8m-4 6h.01"
                    />
                  </svg>
                  <span>Ad account: {metaConnection.ad_account_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-[#00C2CB]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M18.364 5.636A9 9 0 015.636 18.364 9 9 0 1118.364 5.636z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>Page: {pageName ?? metaConnection.page_id}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-medium pt-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Status: Connected</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#101213] border border-white/5 rounded-2xl p-6 sm:p-7 text-xs sm:text-sm text-gray-300 space-y-3">
              <h2 className="text-sm font-semibold text-white">What happens when you connect?</h2>
              <p>
                Nettmark uses this connection to spin up campaigns from approved affiliate ad ideas, track spend, and
                route performance back to your dashboard — without changing how you currently manage your ads.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
                  <span>Campaigns are created in your ad account under a Nettmark naming structure.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
                  <span>You can pause, edit, or delete any campaign directly in Meta at any time.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
                  <span>No changes are made to billing setup or payment methods inside your business manager.</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
