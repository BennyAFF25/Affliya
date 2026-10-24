import type { SupabaseClient } from "@supabase/supabase-js";

type ProposalNotification = {
  user_email: string;
  title: string;
  body: string;
  link_url: string;
};

// Match the existing inbox insert shape. The proposal-specific link identifies
// this event without depending on unsupported type or metadata columns.
export async function notifyPaidProposal(db: SupabaseClient, row: ProposalNotification) {
  try {
    const { data, error } = await db.from("notifications").select("id")
      .eq("user_email", row.user_email).eq("link_url", row.link_url).limit(1);
    if (error) throw error;
    if (data?.length) return;
    const { error: insertError } = await db.from("notifications").insert([row]);
    if (insertError) throw insertError;
  } catch (error) {
    console.warn("[proposal-submitted] notification insert failed", error);
  }
}
