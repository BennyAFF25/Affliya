import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "../supabase/createServerClient";

// Only aggregate integers cross the server/client boundary. Never select records.
export const getMarketplaceCounts = unstable_cache(async () => {
  try {
    const admin = createServerSupabaseClient();
    const [offers, affiliates] = await Promise.all([
      admin.from("offers").select("id", { count: "exact", head: true }).is("archived_at", null).neq("participation_mode", "private"),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "affiliate"),
    ]);
    if (offers.error || affiliates.error ||
        !Number.isSafeInteger(offers.count) || !Number.isSafeInteger(affiliates.count) ||
        offers.count! <= 0 || affiliates.count! <= 0) return null;
    return { offers: offers.count!, affiliates: affiliates.count! };
  } catch {
    return null;
  }
}, ["marketing-marketplace-counts"], { revalidate: 3600 });
