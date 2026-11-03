import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { getBusinessEntitlement } from "../../../../utils/businessEntitlements";
import { CONNECT_META_SEARCH_HEADER, connectMetaGrowthGateRedirect } from "../../../../utils/meta/connectMetaGate";

export const dynamic = "force-dynamic";

export default async function ConnectMetaLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userSupabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user?.email) {
    redirect(
      "/login?role=business&returnTo=%2Fbusiness%2Fmy-business%2Fconnect-meta",
    );
  }

  const admin = createServerSupabaseClient();
  const entitlement = await getBusinessEntitlement({
    businessEmail: user.email,
    supabase: admin,
  });

  // Meta paid-ad infrastructure is only available to businesses that can
  // currently launch paid campaigns. This includes active Growth trials,
  // active Growth subscriptions, and grandfathered businesses.
  if (!entitlement?.canLaunchCampaign) {
    const search = (await headers()).get(CONNECT_META_SEARCH_HEADER);
    redirect(connectMetaGrowthGateRedirect(search));
  }

  return children;
}
