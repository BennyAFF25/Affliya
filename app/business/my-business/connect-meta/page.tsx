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
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10">
      <div className="max-w-2xl mx-auto bg-[#1F1F1F] p-8 rounded-xl shadow-md border border-[#00C2CB]/30">
        <div className="flex items-center gap-3 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 21a4 4 0 01-5.656 0l-5.657-5.657a4 4 0 010-5.656l5.657-5.657a4 4 0 015.656 0l5.657 5.657a4 4 0 010 5.656L13.828 21z" />
          </svg>
          <h1 className="text-2xl font-bold text-[#00C2CB]">Connect Meta Ads</h1>
        </div>
        <p className="text-gray-400 mb-6 text-sm">
          Link your Meta Business Manager to run ads through your own account. Full transparency, control, and compliance with Meta&apos;s guidelines.
        </p>
        <a
          href={`https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=https://affliya.vercel.app/api/meta/callback&scope=pages_show_list,ads_management,business_management,pages_read_engagement,pages_read_user_content,ads_read,pages_manage_ads&response_type=code`}
          className="inline-flex items-center gap-2 bg-white text-[#00C2CB] hover:bg-[#e0fafa] px-5 py-2 rounded-full font-semibold transition shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2.003 9.25C2.003 5.53 5.533 2 9.253 2s7.25 3.53 7.25 7.25-3.53 7.25-7.25 7.25A7.252 7.252 0 012.003 9.25zm7.25-3.75a.75.75 0 00-1.5 0v2.25H5.503a.75.75 0 000 1.5H7.75v2.25a.75.75 0 001.5 0v-2.25h2.25a.75.75 0 000-1.5H9.253V5.5z"/>
          </svg>
          Connect My Meta Account
        </a>
      </div>
      {metaConnection && (
        <div className="max-w-2xl mx-auto mt-8 bg-[#1F1F1F] text-white p-6 rounded-xl border border-[#00C2CB]/30 shadow-sm">
          <div className="flex items-center gap-2 text-lg text-[#00C2CB] font-semibold mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 21a4 4 0 01-5.656 0l-5.657-5.657a4 4 0 010-5.656l5.657-5.657a4 4 0 015.656 0l5.657 5.657a4 4 0 010 5.656L13.828 21z" />
            </svg>
            Connected Meta Account
          </div>
          <div className="space-y-2 text-gray-300 text-sm">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A3 3 0 017 17h10a3 3 0 012.121.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>User: {metaConnection.meta_user_name} ({metaConnection.meta_user_email})</span>
            </div>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a4 4 0 00-8 0v2m0 0v6m0-6h8m-4 6h.01" />
              </svg>
              <span>Ad Account ID: {metaConnection.ad_account_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636A9 9 0 015.636 18.364 9 9 0 1118.364 5.636z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Page: {pageName ?? metaConnection.page_id}</span>
            </div>
            <div className="flex items-center gap-2 text-green-400 font-medium pt-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Status: Connected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
