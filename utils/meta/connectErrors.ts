// User-facing copy for /api/meta/callback ?meta_error=<reason> redirects.
export const META_SUPPORT_EMAIL = "contact@nettmark.com";
export const ADS_MANAGER_URL = "https://adsmanager.facebook.com/";

export type MetaConnectErrorMessage = {
  title: string;
  body: string;
  link?: { href: string; label: string };
  showSupport: boolean;
};

const PERMISSIONS: MetaConnectErrorMessage = {
  title: "Meta didn't give Nettmark the access it needs",
  body: "Click Connect Meta again and, on Meta's screens, allow every permission Nettmark asks for. If you use 'Edit settings', keep your Page and ad account ticked.",
  showSupport: true,
};

const GENERIC: MetaConnectErrorMessage = {
  title: "We couldn't finish connecting Meta",
  body: "Something went wrong on our side while saving your connection. Please click Connect Meta to try again.",
  showSupport: true,
};

const MESSAGES: Record<string, MetaConnectErrorMessage> = {
  no_ad_account: {
    title: "No Meta ad account was shared with Nettmark",
    body: "Nettmark needs an ad account to run paid campaigns. Create one in Meta Ads Manager (or check you have access to one), then click Connect Meta again and keep the ad account ticked.",
    link: { href: ADS_MANAGER_URL, label: "Open Meta Ads Manager" },
    showSupport: false,
  },
  no_page: {
    title: "No Facebook Page was shared with Nettmark",
    body: "Create or choose a Facebook Page for your business, then click Connect Meta again. On Meta's 'choose what to share' step, keep that Page ticked.",
    showSupport: false,
  },
  nettmark_session: {
    title: "You were signed out of Nettmark during the connection",
    body: "Log in to Nettmark, then click Connect Meta again in the same browser. Use a normal browser like Chrome or Safari, not the in-app browser inside Facebook, Instagram or your email app.",
    showSupport: false,
  },
  token_exchange: PERMISSIONS,
  ad_accounts_fetch: PERMISSIONS,
  pages_fetch: PERMISSIONS,
  user_fetch: PERMISSIONS,
  authorization_failed: PERMISSIONS,
  authorization_cancelled: {
    title: "Meta connection was cancelled",
    body: "No problem. When you're ready, click Connect Meta and approve the request on Meta's screen.",
    showSupport: false,
  },
  missing_code: GENERIC,
  connection_save: GENERIC,
  unexpected: GENERIC,
};

export function getMetaConnectErrorMessage(reason: string | null | undefined): MetaConnectErrorMessage | null {
  if (!reason) return null;
  return MESSAGES[reason] ?? GENERIC;
}
