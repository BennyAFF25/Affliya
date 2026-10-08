type SupabaseLike = {
  from: (table: string) => any;
};

export function formatPublicUsername(value?: string | null) {
  const username = String(value || "").trim().replace(/^@+/, "");
  return username ? `@${username}` : "Nettmark affiliate";
}

export async function getAffiliateUsername(
  supabase: SupabaseLike,
  params: { userId?: string | null; email?: string | null },
) {
  let query = supabase.from("profiles").select("username").limit(1);

  if (params.userId) {
    query = query.eq("id", params.userId);
  } else if (params.email) {
    query = query.eq("email", String(params.email).trim().toLowerCase());
  } else {
    return "Nettmark affiliate";
  }

  const { data } = await query.maybeSingle();
  return formatPublicUsername(data?.username);
}

export async function getBusinessDisplayName(
  supabase: SupabaseLike,
  email?: string | null,
) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return "Business";

  const { data } = await supabase
    .from("business_profiles")
    .select("business_name")
    .eq("business_email", normalized)
    .limit(1)
    .maybeSingle();

  return String(data?.business_name || "").trim() || "Business";
}
