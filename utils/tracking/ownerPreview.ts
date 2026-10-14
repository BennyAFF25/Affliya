/** A query flag is not authority. Only verified runtime ownership permits preview. */
export function isOwnerPreview(requested: boolean, userEmail: string | null | undefined, ownerEmail: string | null) {
  return requested && Boolean(userEmail && ownerEmail && userEmail.toLowerCase() === ownerEmail.toLowerCase());
}
export function previewTrackingUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (["nettmark.com", "www.nettmark.com"].includes(url.hostname) && url.pathname.startsWith("/go/")) {
      url.searchParams.set("preview", "1");
    }
    return url.toString();
  } catch { return value; }
}
