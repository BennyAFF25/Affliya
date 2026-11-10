import { env, hasRequiredScopes, validShop } from "./security";

export async function exchangeToken(shop: string, code: string, required: string[], request = fetch) {
  if (!validShop(shop)) throw new Error("invalid_shop");
  const response = await request(`https://${shop}/admin/oauth/access_token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env("SHOPIFY_CLIENT_ID"), client_secret: env("SHOPIFY_CLIENT_SECRET"), code }),
    signal: AbortSignal.timeout(15000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new Error("token_exchange");
  const data = await response.json();
  if (typeof data.access_token !== "string" || !data.access_token || typeof data.scope !== "string") throw new Error("token_exchange");
  const scopes = data.scope.split(",").map((scope: string) => scope.trim()).filter(Boolean) as string[];
  if (!hasRequiredScopes(scopes, required)) throw new Error("missing_scopes");
  return { token: data.access_token as string, scopes };
}
export async function registerWebhooks(shop: string, token: string, base: string, request = fetch): Promise<void> {
  const version = process.env.SHOPIFY_API_VERSION?.trim() || "2026-10";
  if (!validShop(shop) || !/^\d{4}-\d{2}$/.test(version)) throw new Error("configuration");
  const response = await request(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({
      query: `mutation RegisterUninstall($subscription: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: APP_UNINSTALLED, webhookSubscription: $subscription) { webhookSubscription { id } userErrors { field message } } }`,
      variables: { subscription: { uri: `${base}/api/shopify/webhooks`, format: "JSON" } },
    }), signal: AbortSignal.timeout(15000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new Error("webhook_registration");
  const data = await response.json();
  const result = data.data?.webhookSubscriptionCreate;
  if (data.errors?.length || result?.userErrors?.length || !result?.webhookSubscription?.id) throw new Error("webhook_registration");
}

export async function revokeAccess(shop: string, token: string, request = fetch): Promise<void> {
  if (!validShop(shop)) throw new Error("invalid_shop");
  const response = await request(`https://${shop}/admin/api_permissions/current.json`, {
    method: "DELETE", headers: { "X-Shopify-Access-Token": token },
    signal: AbortSignal.timeout(15000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new Error("revoke_access");
}
