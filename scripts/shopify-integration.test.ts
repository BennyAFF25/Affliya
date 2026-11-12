import assert from "node:assert/strict";
import { stripShopifyParams } from "../lib/shopify/callback-params";
import { createHmac, randomBytes } from "node:crypto";
import Module, { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { validShop, normalizeShop, verifyOAuthHmac, verifyWebhookHmac, signState, verifyState, hasRequiredScopes, requiredScopes, encryptToken, decryptToken } from "../lib/shopify/security";
import { handleWebhook, type WebhookStore } from "../lib/shopify/webhooks";
import { exchangeToken, registerWebhooks, revokeAccess, webhookCallbackUrl } from "../lib/shopify/admin";

async function main() {
  assert.equal(stripShopifyParams(""), null);
  assert.equal(stripShopifyParams("?other=1&shopify_extra=keep"), null);
  assert.equal(stripShopifyParams("?shopify=connected"), "");
  assert.equal(stripShopifyParams("?shopify_error="), "");
  assert.equal(stripShopifyParams("?shopify=connected&shopify_error=failed&shopify=again"), "");
  assert.equal(stripShopifyParams("?tab=setup&shopify=connected&next=%2fhello%20world&tab=other"), "?tab=setup&next=%2fhello%20world&tab=other");
  assert.equal(stripShopifyParams("?%73hopify=connected&other=a+b&shopify_error=failed"), "?other=a+b");
  const callbackUrl = new URL("https://example.invalid/business/my-business?shopify=connected&tab=setup#readiness");
  assert.equal(`${callbackUrl.pathname}${stripShopifyParams(callbackUrl.search)}${callbackUrl.hash}`, "/business/my-business?tab=setup#readiness");

  const secret = "mock-secret";
  const params = new URLSearchParams({ shop: "demo.myshopify.com", code: "mock code", timestamp: "123", signature: "legacy" });
  const message = "code=mock code&shop=demo.myshopify.com&timestamp=123";
  params.set("hmac", createHmac("sha256", secret).update(message).digest("hex"));
  assert.ok(verifyOAuthHmac(params, secret));
  assert.ok(!verifyOAuthHmac(params, "wrong"));
  const tampered = new URLSearchParams(params); tampered.set("shop", "other.myshopify.com");
  assert.ok(!verifyOAuthHmac(tampered, secret));
  for (const bad of ["", "ff", "g".repeat(64), "a".repeat(66), "a".repeat(64) + "\n"]) {
    const invalid = new URLSearchParams(params); invalid.set("hmac", bad);
    assert.ok(!verifyOAuthHmac(invalid, secret));
  }
  const duplicate = new URLSearchParams(params); duplicate.append("shop", "evil.com");
  assert.ok(!verifyOAuthHmac(duplicate, secret));
  const raw = Buffer.from('{ "shop": "demo", "value": "é" }\n');
  const header = createHmac("sha256", secret).update(raw).digest("base64");
  assert.ok(verifyWebhookHmac(raw, header, secret));
  assert.ok(!verifyWebhookHmac(Buffer.from(JSON.stringify(JSON.parse(raw.toString()))), header, secret));
  assert.ok(!verifyWebhookHmac(raw, null, secret));
  assert.ok(!verifyWebhookHmac(raw, "bad", secret));
  assert.ok(!verifyWebhookHmac(raw, header, "wrong"));

  assert.ok(validShop("foo-123.myshopify.com"));
  for (const bad of ["evil.com", "foo.myshopify.com.evil.com", "Foo.myshopify.com", "foo.myshopify.com/path", "foo.myshopify.com\n", "https://foo.myshopify.com", "-foo.myshopify.com", "foo.myshopify.com@evil.com"]) assert.ok(!validShop(bad), bad);
  assert.equal(normalizeShop(" MyStore "), "mystore.myshopify.com");
  assert.equal(normalizeShop("https://MyStore.myshopify.com/"), "mystore.myshopify.com");
  assert.throws(() => normalizeShop("foo.myshopify.com/path"));
  assert.throws(() => normalizeShop(""));

  const now = Date.now();
  const state = { nonce: "mock-nonce", userId: "user", businessId: "business", shop: "demo.myshopify.com", issuedAt: now };
  const signed = signState(state, secret);
  assert.deepEqual(verifyState(signed, state.nonce, secret, now + 1000), state);
  assert.throws(() => verifyState(signed, state.nonce, secret, now + 600001));
  assert.throws(() => verifyState(signed, state.nonce, secret, now - 1));
  assert.throws(() => verifyState(signed, "wrong-nonce", secret, now));
  assert.throws(() => verifyState(signed, undefined, secret, now));
  assert.throws(() => verifyState(signed.replace(/^./, signed[0] === "A" ? "B" : "A"), state.nonce, secret, now));
  assert.throws(() => verifyState(signed, state.nonce, "wrong", now));
  assert.throws(() => verifyState("invalid", state.nonce, secret, now));
  assert.throws(() => verifyState(signState({ ...state, shop: "evil.com" }, secret), state.nonce, secret, now));

  const previousScopes = process.env.SHOPIFY_SCOPES;
  delete process.env.SHOPIFY_SCOPES;
  const required = requiredScopes();
  assert.deepEqual(required, ["read_products", "write_pixels", "read_customer_events"]);
  assert.ok(hasRequiredScopes([...required, "read_pixels"], required));
  assert.ok(!hasRequiredScopes(["read_products"], required));
  for (const scopes of ["read_products,write_pixels", "read_products,write_pixels,read_customer_events,read_pixels", "read_products,write_pixels,write_pixels"]) {
    process.env.SHOPIFY_SCOPES = scopes;
    assert.throws(() => requiredScopes());
  }
  process.env.SHOPIFY_SCOPES = "read_orders";
  assert.throws(() => requiredScopes());
  process.env.SHOPIFY_SCOPES = "read_customers";
  assert.throws(() => requiredScopes());
  if (previousScopes === undefined) delete process.env.SHOPIFY_SCOPES;
  else process.env.SHOPIFY_SCOPES = previousScopes;

  for (const key of [randomBytes(32).toString("hex"), randomBytes(32).toString("base64")]) {
    const encrypted = encryptToken("mock-offline-token", key);
    assert.equal(decryptToken(encrypted, key), "mock-offline-token");
    assert.notEqual(encryptToken("mock-offline-token", key), encrypted);
    const parts = encrypted.split(":");
    const bytes = Buffer.from(parts[3], "base64"); bytes[0] ^= 1;
    parts[3] = bytes.toString("base64");
    assert.throws(() => decryptToken(parts.join(":"), key));
    assert.throws(() => decryptToken(encrypted, randomBytes(32).toString("hex")));
  }
  assert.throws(() => encryptToken("token", "bad-key"));
  assert.throws(() => decryptToken("v2:a:b:c", randomBytes(32).toString("hex")));

  const rows = new Map<string, { status: string; token: string | null; uninstalledAt?: string }>();
  rows.set(state.shop, { status: "connected", token: "encrypted" });
  rows.set("other.myshopify.com", { status: "connected", token: "other" });
  const calls: string[] = [];
  const db: WebhookStore = {
    async uninstall(shop, timestamp) {
      calls.push("uninstall");
      const row = rows.get(shop);
      if (row && row.status !== "uninstalled") rows.set(shop, { status: "uninstalled", token: null, uninstalledAt: timestamp });
    },
    async redact(shop) { calls.push("redact"); rows.delete(shop); },
  };
  await handleWebhook("app/uninstalled", state.shop, db, "2026-11-10T12:00:00Z");
  await handleWebhook("app/uninstalled", state.shop, db, "2026-11-10T12:01:00Z");
  assert.deepEqual(rows.get(state.shop), { status: "uninstalled", token: null, uninstalledAt: "2026-11-10T12:00:00Z" });
  calls.length = 0;
  for (const topic of ["customers/data_request", "customers/redact", "unknown"]) await handleWebhook(topic, state.shop, db);
  assert.deepEqual(calls, []);
  await handleWebhook("shop/redact", state.shop, db);
  await handleWebhook("shop/redact", state.shop, db);
  assert.ok(!rows.has(state.shop));
  assert.ok(rows.has("other.myshopify.com"));
  await assert.rejects(handleWebhook("shop/redact", state.shop, { ...db, async redact() { throw new Error("db unavailable"); } }));

  // All HTTP calls are injected mocks. No network is used by this suite.
  process.env.SHOPIFY_CLIENT_ID = "mock-client";
  process.env.SHOPIFY_CLIENT_SECRET = secret;
  const request: typeof fetch = async (url, options) => {
    assert.equal(url, `https://${state.shop}/admin/oauth/access_token`);
    const payload = JSON.parse(String(options?.body));
    assert.deepEqual(Object.keys(payload).sort(), ["client_id", "client_secret", "code"]);
    assert.equal(payload.code, "mock-code");
    return Response.json({ access_token: "mock-token", scope: [...required, "read_pixels"].join(",") });
  };
  assert.equal((await exchangeToken(state.shop, "mock-code", required, request)).token, "mock-token");
  await assert.rejects(exchangeToken(state.shop, "mock-code", required, async () => Response.json({ access_token: "mock", scope: "read_products" })), /missing_scopes/);
  await assert.rejects(exchangeToken(state.shop, "mock-code", required, async () => new Response(null, { status: 500 })), /token_exchange/);
  await assert.rejects(exchangeToken("evil.com", "mock-code", required, request), /invalid_shop/);
  const webhookBase = "https://preview.example";
  const plainCallback = `${webhookBase}/api/shopify/webhooks`;
  const previewEnv = { VERCEL_ENV: "preview", VERCEL_AUTOMATION_BYPASS_SECRET: "  mock +/&?=secret  " };
  const previewCallback = `${plainCallback}?x-vercel-protection-bypass=mock+%2B%2F%26%3F%3Dsecret`;
  assert.equal(webhookCallbackUrl(webhookBase, previewEnv), previewCallback);
  for (const VERCEL_ENV of ["production", "development", undefined]) {
    assert.equal(webhookCallbackUrl(webhookBase, { ...previewEnv, VERCEL_ENV }), plainCallback);
  }
  assert.equal(webhookCallbackUrl(webhookBase, { VERCEL_ENV: "preview" }), plainCallback);
  assert.equal(webhookCallbackUrl(webhookBase, { ...previewEnv, VERCEL_AUTOMATION_BYPASS_SECRET: " \t " }), plainCallback);
  await registerWebhooks(state.shop, "mock-token", webhookBase, async (_url, options) => {
    assert.equal(JSON.parse(String(options?.body)).variables.subscription.uri, previewCallback);
    return Response.json({ data: { webhookSubscriptionCreate: { webhookSubscription: { id: "mock-preview-id" }, userErrors: [] } } });
  }, previewEnv);
  delete process.env.SHOPIFY_API_VERSION;
  await registerWebhooks(state.shop, "mock-token", "https://preview.example", async (url, options) => {
    assert.equal(url, `https://${state.shop}/admin/api/2026-10/graphql.json`);
    const body = JSON.parse(String(options?.body));
    assert.match(body.query, /APP_UNINSTALLED/);
    assert.equal(body.variables.subscription.uri, "https://preview.example/api/shopify/webhooks");
    return Response.json({ data: { webhookSubscriptionCreate: { webhookSubscription: { id: "mock-id" }, userErrors: [] } } });
  });
  await assert.rejects(registerWebhooks(state.shop, "mock-token", "https://preview.example", async () => Response.json({ data: { webhookSubscriptionCreate: { userErrors: [{ message: "mock" }] } } })));

  await revokeAccess(state.shop, "mock-token", async (url, options) => {
    assert.equal(url, `https://${state.shop}/admin/api_permissions/current.json`);
    assert.equal(options?.method, "DELETE");
    assert.deepEqual(options?.headers, { "X-Shopify-Access-Token": "mock-token" });
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal instanceof AbortSignal);
    return new Response(null, { status: 200 });
  });
  await assert.rejects(revokeAccess(state.shop, "mock-token", async () => new Response(null, { status: 500 })), /revoke_access/);
  await assert.rejects(revokeAccess("evil.com", "mock-token", request), /invalid_shop/);

  const status = readFileSync("app/api/shopify/status/route.ts", "utf8");
  assert.doesNotMatch(status, /access_token|select\("\*"\)/);
  for (const route of ["install", "callback", "status", "disconnect", "webhooks"]) {
    const source = readFileSync(`app/api/shopify/${route}/route.ts`, "utf8");
    assert.match(source, /export const runtime = "nodejs"/);
    assert.match(source, /export const dynamic = "force-dynamic"/);
  }
  await testRoutes(secret);
  console.log("shopify-integration: all mock tests passed");
}
async function testRoutes(secret: string) {
  type Row = Record<string, unknown>;
  const owner = "00000000-0000-0000-0000-000000000001";
  let user: { id: string; email: string } | null = { id: "user", email: "mock@example.invalid" };
  let role = "business";
  let failDb = false;
  let rows: Row[] = [];
  let networkCalls = 0;
  let connectBeforeUpdate = false;
  let pixelMode: "active" | "undeployed" = "undeployed";
  let pixelId: string | null = null;
  const lifecycle: string[] = [];
  const db = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table: string) {
      let matched = table === "profiles" ? [{ id: user?.id, role }] as Row[] : table === "business_profiles" ? [{ id: owner, business_email: user?.email }] as Row[] : rows;
      let update: Row | undefined;
      let insertion: Row | undefined;
      let deletion = false;
      let selection = "";
      const result = () => {
        if (failDb) return { data: null, error: { code: "mock-db-error" } };
        if (update) matched.forEach(row => Object.assign(row, update));
        if (insertion) rows.push({ id: owner, ...insertion });
        if (deletion) rows = rows.filter(row => !matched.includes(row));
        const data = selection ? matched.map(row => Object.fromEntries(selection.split(",").map(key => [key, row[key]]))) : matched;
        return { data, error: null };
      };
      const query = {
        select(columns: string) { selection = columns; return query; },
        eq(key: string, value: unknown) { matched = matched.filter(row => row[key] === value); return query; },
        neq(key: string, value: unknown) { matched = matched.filter(row => row[key] !== value); return query; },
        lt(key: string, value: string) { matched = matched.filter(row => String(row[key]) < value); return query; },
        update(value: Row) { if (connectBeforeUpdate) { matched.forEach(row => { row.status = "connected"; }); connectBeforeUpdate = false; } update = value; return query; },
        insert(value: Row) { insertion = value; return query; },
        delete() { deletion = true; return query; },
        order() { return query; },
        async maybeSingle() { const res = result(); return { ...res, data: res.data?.[0] || null }; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return query;
    },
  };
  const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
  const originalLoad = loader._load;
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const load = createRequire(__filename);
  loader._load = function(name, parent, isMain) {
    if (name.includes("supabase/createServerClient")) return { createServerSupabaseClient: () => db };
    if (name === "@supabase/auth-helpers-nextjs") return { createRouteHandlerClient: () => db };
    if (name === "next/headers") return { cookies: () => ({}) };
    return originalLoad.call(this, name, parent, isMain);
  };
  globalThis.fetch = async (url, options) => {
    networkCalls++;
    if (String(url).endsWith("/graphql.json")) {
      const body = JSON.parse(String(options?.body));
      if (body.query.includes("RegisterUninstall")) {
        assert.equal(body.variables.subscription.uri, "https://www.nettmark.com/api/shopify/webhooks");
        throw new Error("mock registration failure");
      }
      if (body.query.startsWith("query")) return Response.json({ data: { webPixel: pixelId ? { id: pixelId } : null } });
      if (body.query.includes("webPixelDelete")) {
        lifecycle.push("pixel_delete");
        const old = pixelId; pixelId = null;
        return Response.json({ data: { webPixelDelete: { deletedWebPixelId: old, userErrors: [] } } });
      }
      const action = body.query.includes("webPixelUpdate") ? "webPixelUpdate" : "webPixelCreate";
      if (pixelMode === "undeployed") return Response.json({ data: { [action]: { userErrors: [{ message: "No web pixel extension found for this app." }] } } });
      pixelId = "gid://shopify/WebPixel/1";
      return Response.json({ data: { [action]: { webPixel: { id: pixelId }, userErrors: [] } } });
    }
    if (String(url).endsWith("/admin/api_permissions/current.json")) {
      lifecycle.push("revoke");
      return new Response(null, { status: 200 });
    }
    if (String(url).endsWith("/admin/oauth/access_token")) return Response.json({ access_token: "mock-offline", scope: "read_products,write_pixels,read_customer_events" });
    throw new Error("mock registration failure");
  };
  console.warn = () => {};
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.NEXT_PUBLIC_BASE_URL = "https://www.nettmark.com";
  delete process.env.SHOPIFY_STATE_SECRET;
  delete process.env.SHOPIFY_SCOPES;
  try {
    const install = load("../app/api/shopify/install/route") as { GET: (req: NextRequest) => Promise<Response> };
    const callback = load("../app/api/shopify/callback/route") as typeof install;
    const status = load("../app/api/shopify/status/route") as { GET: () => Promise<Response> };
    const pixel = load("../app/api/shopify/pixel/route") as { POST: (req: NextRequest) => Promise<Response> };
    const disconnect = load("../app/api/shopify/disconnect/route") as { POST: (req: NextRequest) => Promise<Response> };
    const webhooks = load("../app/api/shopify/webhooks/route") as typeof disconnect;
    const started = await install.GET(new NextRequest("https://preview.example/api/shopify/install?shop=demo"));
    const authorization = new URL(started.headers.get("location")!);
    assert.equal(authorization.hostname, "demo.myshopify.com");
    assert.equal(authorization.searchParams.get("redirect_uri"), "https://preview.example/api/shopify/callback");
    assert.ok(!authorization.searchParams.has("grant_options[]"));
    const stateValue = authorization.searchParams.get("state")!;
    const cookie = started.headers.get("set-cookie")!.split(";")[0];
    const callbackRequest = (overrides: Record<string, string> = {}, sendCookie = true) => {
      const params = new URLSearchParams({ shop: "demo.myshopify.com", code: "mock-code", state: stateValue, ...overrides });
      const message = Array.from(params.entries()).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("&");
      params.set("hmac", createHmac("sha256", secret).update(message).digest("hex"));
      return new NextRequest(`https://preview.example/api/shopify/callback?${params}`, { headers: sendCookie ? { cookie } : {} });
    };
    const errorOf = (response: Response) => new URL(response.headers.get("location")!).searchParams.get("shopify_error");
    assert.equal(errorOf(await callback.GET(callbackRequest({}, false))), "invalid_state");
    assert.equal(errorOf(await callback.GET(callbackRequest({ shop: "other.myshopify.com" }))), "invalid_state");
    user = { id: "other-user", email: "other@example.invalid" };
    assert.equal(errorOf(await callback.GET(callbackRequest())), "session_mismatch");
    user = null;
    assert.equal((await status.GET()).status, 401);
    user = { id: "user", email: "mock@example.invalid" };
    role = "affiliate";
    assert.equal((await status.GET()).status, 403);
    role = "business";
    const invalidHmac = callbackRequest();
    invalidHmac.nextUrl.searchParams.set("hmac", "0".repeat(64));
    const rejected = await callback.GET(invalidHmac);
    assert.equal(errorOf(rejected), "invalid_hmac");
    assert.match(rejected.headers.get("set-cookie")!, /Max-Age=0/i);
    assert.equal(networkCalls, 0, "invalid callbacks cannot exchange tokens");
    const success = await callback.GET(callbackRequest());
    assert.equal(new URL(success.headers.get("location")!).origin, "https://preview.example");
    assert.equal(new URL(success.headers.get("location")!).searchParams.get("shopify"), "connected", "registration failure is non-fatal");
    assert.match(success.headers.get("set-cookie")!, /Max-Age=0/i);
    assert.match(String(rows[0].access_token_encrypted), /^v1:/);
    assert.equal(rows[0].status, "connected");
    assert.equal(rows[0].pixel_status, "error");
    assert.equal(rows[0].pixel_error, "extension_not_deployed", "undeployed extension does not break install");
    pixelMode = "active";
    assert.equal(new URL((await callback.GET(callbackRequest())).headers.get("location")!).searchParams.get("shopify"), "connected");
    assert.equal(rows[0].pixel_status, "active", "callback automatically creates pixel");
    assert.ok(!JSON.stringify(await (await status.GET()).json()).includes("access_token"));
    rows[0].business_id = "other-business";
    const disconnectRequest = (origin = "https://preview.example") => new NextRequest("https://preview.example/api/shopify/disconnect", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ id: owner }) });
    assert.equal(errorOf(await callback.GET(callbackRequest())), "shop_already_connected");
    assert.equal((await disconnect.POST(disconnectRequest("https://evil.example"))).status, 403);
    await disconnect.POST(disconnectRequest());
    assert.equal(rows[0].status, "connected", "other business cannot disconnect");
    rows[0].status = "uninstalled";
    connectBeforeUpdate = true;
    assert.equal(errorOf(await callback.GET(callbackRequest())), "shop_already_connected", "conditional update cannot steal a newly connected row");
    assert.equal(rows[0].business_id, "other-business");
    rows[0].status = "uninstalled";
    assert.equal(new URL((await callback.GET(callbackRequest())).headers.get("location")!).searchParams.get("shopify"), "connected");
    assert.equal(rows[0].business_id, owner, "inactive store can be reassigned");
    rows[0].business_id = owner;
    const pixelRequest = (origin = "https://preview.example") => new NextRequest("https://preview.example/api/shopify/pixel", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ id: owner }) });
    assert.equal((await pixel.POST(pixelRequest("https://evil.example"))).status, 403);
    rows[0].business_id = "another-owner";
    assert.equal((await pixel.POST(pixelRequest())).status, 404);
    rows[0].business_id = owner;
    assert.equal((await pixel.POST(pixelRequest())).status, 200);
    assert.equal(rows[0].pixel_status, "active");
    lifecycle.length = 0;
    await disconnect.POST(disconnectRequest());
    assert.equal(rows[0].status, "disconnected");
    assert.equal(rows[0].pixel_status, "inactive");
    assert.deepEqual(lifecycle, ["pixel_delete", "revoke"], "delete pixel before token revocation");
    assert.equal(rows[0].access_token_encrypted, null);
    const raw = Buffer.from("mock raw webhook bytes");
    const webhookRequest = (topic: string, hmac = createHmac("sha256", secret).update(raw).digest("base64")) => new NextRequest("https://preview.example/api/shopify/webhooks", { method: "POST", headers: { "x-shopify-topic": topic, "x-shopify-shop-domain": "demo.myshopify.com", "x-shopify-hmac-sha256": hmac }, body: raw });
    assert.equal((await webhooks.POST(webhookRequest("app/uninstalled", "invalid"))).status, 401);
    const invalidShop = webhookRequest("app/uninstalled");
    invalidShop.headers.set("x-shopify-shop-domain", "demo.myshopify.com.evil.com");
    assert.equal((await webhooks.POST(invalidShop)).status, 400);
    const delayed = webhookRequest("app/uninstalled");
    delayed.headers.set("x-shopify-triggered-at", "2000-01-01T00:00:00Z");
    assert.equal((await webhooks.POST(delayed)).status, 200);
    assert.equal(rows[0].status, "disconnected", "old uninstall cannot wipe a newer installation");
    const uninstall = webhookRequest("app/uninstalled");
    uninstall.headers.set("x-shopify-triggered-at", new Date(Date.now() + 1000).toISOString());
    assert.equal((await webhooks.POST(uninstall)).status, 200);
    assert.equal(rows[0].status, "uninstalled");
    assert.equal(rows[0].pixel_status, "inactive");
    assert.equal(rows[0].access_token_encrypted, null);
    for (const topic of ["customers/data_request", "customers/redact", "unknown"]) assert.equal((await webhooks.POST(webhookRequest(topic))).status, 200);
    failDb = true;
    assert.equal((await webhooks.POST(webhookRequest("shop/redact"))).status, 503);
    failDb = false;
    assert.equal((await webhooks.POST(webhookRequest("shop/redact"))).status, 200);
    assert.equal(rows.length, 0);
    assert.equal((await webhooks.POST(webhookRequest("shop/redact"))).status, 200);
  } finally {
    loader._load = originalLoad;
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
