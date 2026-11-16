import { env, hasRequiredScopes, validShop } from "./security";

// Shared Admin GraphQL transport; callers classify API/user errors without logging bodies.
export async function adminGraphql(shop: string, token: string, query: string, variables: Record<string, unknown> = {}, request = fetch, failure = 'admin_api_failed') {
  const version = process.env.SHOPIFY_API_VERSION?.trim() || '2026-10';
  if (!validShop(shop) || !/^\d{4}-\d{2}$/.test(version)) throw new Error('configuration');
  const response = await request(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store',
  });
  if (!response.ok) throw new Error(failure);
  return response.json();
}

export async function exchangeToken(shop: string, code: string, required: string[], request = fetch) {
  if (!validShop(shop)) throw new Error("invalid_shop");
  const data = await tokenRequest(shop, { code, expiring: "1" }, request);
  if (typeof data.scope !== "string") throw new Error("token_exchange");
  const scopes = data.scope.split(",").map((scope: string) => scope.trim()).filter(Boolean) as string[];
  if (!hasRequiredScopes(scopes, required)) throw new Error("missing_scopes");
  return { ...parseTokenPair(data), scopes };
}
export type TokenPair = { token: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string };
function parseTokenPair(data: Record<string, unknown>): TokenPair {
  if (typeof data.access_token !== "string" || !data.access_token || typeof data.refresh_token !== "string" || !data.refresh_token ||
      typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
      typeof data.refresh_token_expires_in !== "number" || !Number.isFinite(data.refresh_token_expires_in) || data.refresh_token_expires_in <= 0) throw new Error("token_exchange");
  return { token: data.access_token, refreshToken: data.refresh_token,
    accessExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + data.refresh_token_expires_in * 1000).toISOString() };
}
async function tokenRequest(shop: string, fields: Record<string, string>, request: typeof fetch) {
  if (!validShop(shop)) throw new Error("invalid_shop");
  const response = await request(`https://${shop}/admin/oauth/access_token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("SHOPIFY_CLIENT_ID"), client_secret: env("SHOPIFY_CLIENT_SECRET"), ...fields }).toString(),
    signal: AbortSignal.timeout(15000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new Error(fields.refresh_token && [400, 401, 403].includes(response.status) ? "reauth_required" : "token_exchange");
  return response.json();
}
export async function refreshToken(shop: string, refresh: string, request = fetch): Promise<TokenPair> {
  return parseTokenPair(await tokenRequest(shop, { grant_type: "refresh_token", refresh_token: refresh }, request));
}
export function webhookCallbackUrl(base: string, environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): string {
  return protectedCallbackUrl(`${base}/api/shopify/webhooks`, environment);
}

export function protectedCallbackUrl(callback: string, environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): string {
  const secret = environment.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (environment.VERCEL_ENV !== "preview" || !secret) return callback;
  const url = new URL(callback);
  url.searchParams.set("x-vercel-protection-bypass", secret);
  return url.toString();
}

export async function registerWebhooks(shop: string, token: string, base: string, request = fetch, environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): Promise<void> {
  for (const topic of ['APP_UNINSTALLED', 'APP_SUBSCRIPTIONS_UPDATE']) {
    const data = await adminGraphql(shop, token,
      `mutation RegisterWebhook($subscription: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: ${topic}, webhookSubscription: $subscription) { webhookSubscription { id } userErrors { field message } } }`,
      { subscription: { uri: webhookCallbackUrl(base, environment), format: "JSON" } }, request, 'webhook_registration');
    const result = data.data?.webhookSubscriptionCreate;
    if (data.errors?.length || result?.userErrors?.length || !result?.webhookSubscription?.id) throw new Error("webhook_registration");
  }
}

export async function revokeAccess(shop: string, token: string, request = fetch): Promise<void> {
  if (!validShop(shop)) throw new Error("invalid_shop");
  const version = process.env.SHOPIFY_API_VERSION?.trim() || "2026-10";
  if (!/^\d{4}-\d{2}$/.test(version)) throw new Error("configuration");
  const response = await request(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: "mutation NettmarkUninstall { appUninstall { app { id } userErrors { field message } } }" }),
    signal: AbortSignal.timeout(15000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new Error("revoke_access");
  const data = await response.json();
  if (data.errors?.length || !data.data?.appUninstall || data.data.appUninstall.userErrors?.length) throw new Error("revoke_access");
}
