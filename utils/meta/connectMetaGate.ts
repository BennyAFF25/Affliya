import { safeBusinessReturnTo } from "../safeBusinessReturnTo";

export const CONNECT_META_PATH = "/business/my-business/connect-meta";
export const CONNECT_META_SEARCH_HEADER = "x-nettmark-connect-meta-search";

/** Choose-plan redirect for the connect-meta Growth gate, keeping the original query string (e.g. ?meta_error=). */
export function connectMetaGrowthGateRedirect(search: string | null | undefined) {
  const raw = String(search || "");
  const query = raw && !raw.startsWith("?") ? `?${raw}` : raw;
  const returnTo = safeBusinessReturnTo(`${CONNECT_META_PATH}${query}`) || CONNECT_META_PATH;
  const params = new URLSearchParams({ returnTo, reason: "meta_requires_growth" });
  return `/business/choose-plan?${params.toString()}`;
}
