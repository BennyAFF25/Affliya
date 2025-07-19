"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from '@supabase/auth-helpers-react';

export default function ConnectMetaPage() {
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
    }
  }, [user, router]);

  if (!user) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-6">Connect Meta Ads</h1>
      <p className="mb-4 text-gray-700">
        This is a placeholder screen where businesses will connect their Meta Ads accounts.
      </p>
      <a
        href={`https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=https://affliya.vercel.app/api/meta/callback&scope=pages_show_list,ads_management,business_management,pages_read_engagement,pages_read_user_content,ads_read,pages_manage_ads&response_type=code`}
        className="bg-blue-600 text-white px-4 py-2 rounded-xl inline-block"
      >
        Connect Meta Business Manager
      </a>
    </div>
  );
}