/** Remove callback flags without re-encoding unrelated query parameters. */
export function stripShopifyParams(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has("shopify") && !params.has("shopify_error")) return null;

  const remaining = search.replace(/^\?/, "").split("&").filter(part => {
    const entry = new URLSearchParams(part);
    return !entry.has("shopify") && !entry.has("shopify_error");
  }).join("&");
  return remaining ? `?${remaining}` : "";
}
