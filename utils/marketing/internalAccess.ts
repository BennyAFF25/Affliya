const FALLBACK_ALLOWED_EMAILS = [
  "ben@falconx.com.au",
  "support@nettmark.com",
];

export function getMarketingDashboardAllowlist(): string[] {
  const raw = process.env.INTERNAL_MARKETING_DASHBOARD_EMAILS || "";
  const envEmails = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...FALLBACK_ALLOWED_EMAILS, ...envEmails]));
}

export function canAccessMarketingDashboard(email?: string | null): boolean {
  if (!email) return false;
  return getMarketingDashboardAllowlist().includes(email.trim().toLowerCase());
}
