import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { canAccessMarketingDashboard } from "@/../utils/marketing/internalAccess";
import MarketingDashboardClient from "./page.client";

export const metadata: Metadata = {
  title: "Internal Marketing Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function InternalMarketingPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !canAccessMarketingDashboard(user.email)) {
    notFound();
  }

  return <MarketingDashboardClient viewerEmail={user.email} />;
}
