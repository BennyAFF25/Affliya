# Shopify: stage one — connect store

Stage one adds an optional Shopify card in Business → My Business → Setup access / Readiness checklist alongside Meta. It connects a store; it does not import products, install a pixel, mark tracking ready, gate publication, or change billing. Multiple stores can belong to a business. A connected shop cannot be reassigned to another business. Fresh OAuth can reassign disconnected or uninstalled shops; conditional writes prevent stealing a connected row.

## Setup

Use the public, non-embedded authorization-code app in Shopify's Dev Dashboard. Client ID: `504d490cc8b4e692142ff5713bfa6de3`. App URL: `https://nettmark.com/api/shopify/install`. Register callback URLs for each actual origin:

- `https://nettmark.com/api/shopify/callback`
- `https://www.nettmark.com/api/shopify/callback`
- `http://localhost:3000/api/shopify/callback`
- Any approved Preview origin with `/api/shopify/callback`.

OAuth callback and all install/callback result redirects use the request origin to preserve nonce/session cookie host binding. Only the webhook subscription URI uses `NEXT_PUBLIC_BASE_URL` origin when configured. Shopify must allowlist every callback origin.

App launch requires an existing logged-in Nettmark business session and a provisioned business profile. If absent, the business page receives an error; sign in and connect from Setup access / Readiness checklist. New businesses sign up at `/create-account?role=business`. No per-user grant is requested: the exchanged token is offline.

Environment template: [`.env.example`](../.env.example) (this repository had no existing env example). Required server configuration:

| Variable | Purpose |
| --- | --- |
| `SHOPIFY_CLIENT_ID` | App client ID |
| `SHOPIFY_CLIENT_SECRET` | OAuth and webhook HMAC secret |
| `SHOPIFY_STATE_SECRET` | Optional independent state secret; falls back to client secret |
| `SHOPIFY_TOKEN_ENCRYPTION_KEY` | Required random 32-byte key, base64 or hex; generate locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` |
| `SHOPIFY_SCOPES` | Defaults exactly to `read_products,write_pixels,read_customer_events` |
| `SHOPIFY_API_VERSION` | Defaults to `2026-10` |
| `NEXT_PUBLIC_BASE_URL` | Optional canonical webhook origin; otherwise request origin. OAuth always uses the request origin |
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Existing Supabase server URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server-only service role key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Existing session client configuration |

Stage one permits only product/pixel/customer-event scopes (also `read_pixels`); order and customer scopes are rejected, including `read_orders`. Extra implied scopes returned by Shopify are accepted, but all requested scopes must be granted. Preserve the encryption key securely: rotating it requires reconnecting stores or an explicitly planned decrypt/re-encrypt migration. Tokens are versioned AES-256-GCM ciphertext with random IVs; no plaintext token is exposed to clients.

Shopify's grant screen shows its standard customer-data, staff-data and web-pixel disclosure for the pixel scopes (`write_pixels` / `read_customer_events`). This is expected and does not mean Nettmark stores customer data.

Prepare/apply `supabase/migrations/20261110120000_shopify_stores.sql` separately through the authorized release process. It links `business_profiles.id` to a unique, validated shop domain, stores ciphertext/scopes/status/timestamps, enables RLS, and revokes client access. Status is exposed through an authenticated server route with an explicit safe column list. The manual destructive rollback is `supabase/undo/20261110120000_shopify_stores.undo.sql`; it deletes saved connections and requires reconnecting stores. Neither SQL script was applied as part of implementation.

## Preview webhooks and Vercel automation bypass

When `VERCEL_ENV=preview` and the trimmed `VERCEL_AUTOMATION_BYPASS_SECRET` is non-empty, automatic uninstall registration appends the URL-encoded `x-vercel-protection-bypass` query parameter to the webhook callback. Vercel injects this secret automatically when a project automation bypass exists. Production and development never append it. Never log the callback URL or secret.

Compliance topic URLs configured in the Dev Dashboard must include this query parameter manually when targeting a protected Preview deployment; they do not use automatic registration.

## Routes and lifecycle

- `GET /api/shopify/install?shop=mystore`: session/business verification, optional Shopify launch-query HMAC verification, normalization, signed ten-minute state containing user/business/shop/nonce, httpOnly SameSite=Lax nonce cookie (Secure in production), redirect to Shopify authorization.
- `GET /api/shopify/callback`: strict shop, constant-time query HMAC, state expiry/cookie nonce/shop/session/business checks; offline token exchange; required-scope check; encryption and service-role save; best-effort GraphQL `webhookSubscriptionCreate` for `APP_UNINSTALLED`. Clears nonce cookie on success and failure. Redirects to `/business/my-business?shopify=connected` or `?shopify_error=<reason>`.
- `GET /api/shopify/status`: only current business's connection metadata, no token, no caching.
- `POST /api/shopify/disconnect`: same-origin request, session/business ownership check; nulls token and marks disconnected. Before clearing the token, best-effort revokes Shopify access via DELETE `/admin/api_permissions/current.json` (15-second timeout, redirects rejected). Failure warns with shop only and local disconnect still completes.
- `POST /api/shopify/webhooks`: validates HMAC over exact raw bytes before dispatch, validates strict shop header. Invalid HMAC → 401; invalid shop → 400; transient processing/configuration errors → 503 for retries. Unknown topics → 200. No payload parsing or body logging.

Uninstall clears the token and marks uninstalled with timestamp; repeat delivery is a no-op. Uninstall uses the validated `X-Shopify-Triggered-At` timestamp (Date.parse; missing/invalid falls back to now) and only updates rows installed strictly before that event, preserving newer reconnects. Redaction deletes only the matching shop's complete stored row; repeats succeed. Errors never log tokens, authorization codes, secrets, response payloads or raw webhook bodies. Webhook registration failure warns with the shop only and does not fail installation; check subscriptions in Shopify if a warning occurs. Reconnect may encounter an existing subscription, which remains usable; no parallel subscription is intentionally maintained.

## Compliance webhooks and data minimisation

In the Dev Dashboard / `shopify.app.toml`, configure mandatory compliance topics `customers/data_request`, `customers/redact`, and `shop/redact` to the public HTTPS `/api/shopify/webhooks` URL, API version `2026-10`. These compliance subscriptions **cannot be registered through the Admin API**. Configure them before app review; they are separate from the automatically registered uninstall subscription. Example app configuration:

```toml
[webhooks]
api_version = "2026-10"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://nettmark.com/api/shopify/webhooks"
```

No customer PII is retained: no names, emails, phone numbers, or addresses. Stage one stores only shop connection information; customer request/redaction webhooks acknowledge with 200 and perform no customer-data reads/writes. Shop redaction purges the shop connection. Future tracked conversions are limited to order ID, value, currency, timestamp and affiliate click attribution; future storage must extend shop redaction to purge anything else held for that shop. Product import, automatic Web Pixel installation, and conversion linkage remain later stages and are not implemented here.

## Validation and manual dev-store test plan

Automated, mock-only checks: `yarn test:shopify-integration`, `yarn -s typecheck`, and changed-file ESLint. No network calls are required by tests.

When authorized, apply the migration to a development database, configure env and allowlisted callback origin, then:

1. Sign in as a business, open Setup access / Readiness checklist, enter a dev-store name or full domain and connect. Approve scopes; verify redirect success, connected domain, encrypted token in admin-only SQL, required scopes and uninstall subscription.
2. Confirm no token appears in status JSON, browser responses, logs or authenticated/anon table reads. Test another business/affiliate/anonymous session cannot view/disconnect that store or take ownership while connected. Verify fresh OAuth can reclaim a disconnected/uninstalled shop.
3. Reject altered HMAC, hostname suffix/path/uppercase, expired/tampered state, missing/wrong nonce, another callback user and missing scopes. Callback must clear the cookie; reuse should fail. Verify Preview redirects use its allowlisted origin even with `NEXT_PUBLIC_BASE_URL` set to production.
4. Disconnect and verify Shopify access revocation plus token null/status disconnected; reconnect. Simulate token-exchange/save failures; verify clear error redirects without sensitive logs. Simulate registration failure; installation should still succeed.
5. Send validly signed uninstall and all three compliance deliveries using Shopify's tools; retry each. Verify uninstall timestamp/token, customer-topic 200 with no customer storage, shop redaction removes only that shop. Invalid raw-body HMAC → 401; unknown topic → 200. Simulate DB failure → 503, then retry.
6. Confirm existing Meta, tracking, billing, offers and mobile Setup access / Readiness checklist are unchanged. Revocation failure must still allow local disconnect.

Live Shopify behavior and applied database schema require this later validation; implementation work makes no network calls and applies no migrations. The PR targets `bot-staging` and should list the env, migration and dev-store steps above.
