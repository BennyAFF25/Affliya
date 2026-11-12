/** Shared origin for generated links. Public env accesses stay static for Next.js client builds. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const environment = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  // Prefer the stable branch alias, then the per-deployment host.
  const previewHost = process.env.VERCEL_BRANCH_URL || process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL
    || process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  if (environment === "preview" && previewHost?.trim()) {
    return `https://${previewHost.trim().replace(/\/+$/, "")}`;
  }
  return "https://www.nettmark.com";
}
