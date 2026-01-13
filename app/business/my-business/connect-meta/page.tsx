// app/business/my-business/connect-meta/page.tsx
"use client";

import { useSession } from '@supabase/auth-helpers-react';
import { useEffect, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";

export default function ConnectMetaPage() {
  const session = useSession();
  const user = session?.user;

  const [connections, setConnections] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.email) return;

    const loadConnections = async () => {
      const { data, error } = await supabase
        .from('meta_connections')
        .select(`
          id,
          meta_user_name,
          meta_user_email,
          ad_account_id,
          ad_account_name,
          page_id,
          page_name
        `)
        .eq('business_email', user.email)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to load Meta connections:', error);
      } else {
        setConnections(data || []);
      }
    };

    loadConnections();
  }, [user]);

  const connected = connections.length > 0;

  return (
    <div className="min-h-screen bg-[#050708] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#00C2CB]">
            Connect Meta Ads
          </h1>

          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'
          }`}>
            {connected ? 'Meta connected' : 'Not connected'}
          </span>
        </div>

        {/* Connect button */}
        <a
          href={`https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=https://www.nettmark.com/api/meta/callback&scope=pages_show_list,ads_management,business_management,pages_read_engagement,pages_read_user_content,ads_read,pages_manage_ads&response_type=code`}
          className="inline-flex items-center gap-2 rounded-full bg-[#00C2CB] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#00b0b8]"
        >
          {connected ? 'Reconnect Meta' : 'Connect Meta'}
        </a>

        {/* Connected assets */}
        {connected && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#7ff5fb]">
              Connected Meta Assets
            </h2>

            <div className="grid gap-3">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-white/10 bg-[#0e1112] p-4 text-sm"
                >
                  <div className="font-medium text-white">
                    {c.page_name}
                  </div>
                  <div className="text-white/60 text-xs mt-1">
                    Page ID: {c.page_id}
                  </div>

                  <div className="mt-2 text-xs text-[#00C2CB]">
                    Ad Account: {c.ad_account_name}
                  </div>
                  <div className="text-white/50 text-xs">
                    {c.ad_account_id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}