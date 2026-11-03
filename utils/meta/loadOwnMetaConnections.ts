// Never include access_token: these columns are returned to the browser.
export const META_CONNECTION_PUBLIC_COLUMNS =
  "id,meta_user_name,meta_user_email,ad_account_id,ad_account_name,ad_account_currency,page_id,page_name,pixel_id,pixel_name,created_at";

/** Browser helper: the signed-in business's Meta connections via the server route (oldest first). */
export async function loadOwnMetaConnections<T = Record<string, unknown>>(): Promise<{ data: T[] | null; error: string | null }> {
  try {
    const res = await fetch("/api/business/meta-connections", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: json?.error || `http_${res.status}` };
    return { data: (json?.connections || []) as T[], error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "network_error" };
  }
}
