# Shopify integration

Stage one added an optional Shopify card in Business → My Business → Setup access / Readiness checklist alongside Meta. Stage two adds automatic app-pixel tracking as described below. Product import remains unimplemented; publication gates, tracking-readiness heuristics and billing are unchanged. Multiple stores can belong to a business. A connected shop cannot be reassigned to another business. Fresh OAuth can reassign disconnected or uninstalled shops; conditional writes prevent stealing a connected row.

## Setup

Use the public, non-embedded authorization-code app in Shopify's Dev Dashboard. Client ID: `504d490cc8b4e692142ff5713bfa6de3`. App URL: `https://nettmark.com/api/shopify/install`. Register callback URLs for each actual origin:

- `https://nettmark.com/api/shopify/callback`
- `https://www.nettmark.com/api/shopify/callback`
- `http://localhost:3000/api/shopify/callback`
- `https://affliya-git-feature-shopify-integration-bens-projects-28b82cca.vercel.app/api/shopify/callback`
- Any additional approved Preview origin with `/api/shopify/callback` (add it to app configuration first).

OAuth callback and all install/callback result redirects use the request origin to preserve nonce/session cookie host binding. Webhook and app-pixel ingestion URLs use `NEXT_PUBLIC_BASE_URL` origin when configured. Shopify must allowlist every callback origin.

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

Requested scopes must be exactly `read_products,write_pixels,read_customer_events`; configuration adding/removing any scope, including `read_pixels` or `read_orders`, is rejected. Extra implied scopes returned by Shopify are accepted, but all requested scopes must be granted. Preserve the encryption key securely: rotating it requires reconnecting stores or an explicitly planned decrypt/re-encrypt migration. Tokens are versioned AES-256-GCM ciphertext with random IVs; no plaintext token is exposed to clients.

Shopify's grant screen shows its standard customer-data, staff-data and web-pixel disclosure for the pixel scopes (`write_pixels` / `read_customer_events`). This is expected and does not mean Nettmark stores customer data.

Prepare/apply `supabase/migrations/20261110120000_shopify_stores.sql` separately through the authorized release process. It links `business_profiles.id` to a unique, validated shop domain, stores ciphertext/scopes/status/timestamps, enables RLS, and revokes client access. Status is exposed through an authenticated server route with an explicit safe column list. The manual destructive rollback is `supabase/undo/20261110120000_shopify_stores.undo.sql`; it deletes saved connections and requires reconnecting stores. Neither SQL script was applied as part of implementation.

## Preview webhooks and Vercel automation bypass

When `VERCEL_ENV=preview` and the trimmed `VERCEL_AUTOMATION_BYPASS_SECRET` is non-empty, automatic uninstall registration appends the URL-encoded `x-vercel-protection-bypass` query parameter to the webhook callback. Vercel injects this secret automatically when a project automation bypass exists. Production and development never append it. Never log the callback URL or secret.

Compliance topic URLs configured in the Dev Dashboard must include this query parameter manually when targeting a protected Preview deployment; they do not use automatic registration.

## Routes and lifecycle

- `GET /api/shopify/install?shop=mystore`: session/business verification, optional Shopify launch-query HMAC verification, normalization, signed ten-minute state containing user/business/shop/nonce, httpOnly SameSite=Lax nonce cookie (Secure in production), redirect to Shopify authorization.
- `GET /api/shopify/callback`: strict shop, constant-time query HMAC, state expiry/cookie nonce/shop/session/business checks; offline token exchange; required-scope check; encryption and service-role save; best-effort GraphQL `webhookSubscriptionCreate` for `APP_UNINSTALLED`. Clears nonce cookie on success and failure. Redirects to `/business/my-business?shopify=connected` or `?shopify_error=<reason>`.
- `GET /api/shopify/status`: only current business's connection metadata, no token, no caching.
- `POST /api/shopify/disconnect`: same-origin request, session/business ownership check; nulls token and marks disconnected. Before clearing the token, best-effort deletes the app pixel and then revokes Shopify access via DELETE `/admin/api_permissions/current.json` (15-second timeout, redirects rejected). Failure warns with shop only and local disconnect still completes.
- `POST /api/shopify/webhooks`: validates HMAC over exact raw bytes before dispatch, validates strict shop header. Invalid HMAC → 401; invalid shop → 400; transient processing/configuration errors → 503 for retries. Unknown topics → 200. No payload parsing or body logging.

Uninstall clears the token, marks tracking inactive and marks uninstalled with timestamp; repeat delivery is a no-op. Uninstall uses the validated `X-Shopify-Triggered-At` timestamp (Date.parse; missing/invalid falls back to now) and only updates rows installed strictly before that event, preserving newer reconnects. Redaction purges the matching shop's order-dedupe rows and connection row; repeats succeed. Errors never log tokens, authorization codes, secrets, response payloads or raw webhook bodies. Webhook registration failure warns with the shop only and does not fail installation; check subscriptions in Shopify if a warning occurs. Reconnect may encounter an existing subscription, which remains usable; no parallel subscription is intentionally maintained.

## Compliance webhooks and data minimisation

In the Dev Dashboard / `shopify.app.toml`, configure mandatory compliance topics `customers/data_request`, `customers/redact`, and `shop/redact` to the public HTTPS `/api/shopify/webhooks` URL, API version `2026-10`. These compliance subscriptions **cannot be registered through the Admin API**. Configure them before app review; they are separate from the automatically registered uninstall subscription. Example app configuration:

```toml
[webhooks]
api_version = "2026-10"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://nettmark.com/api/shopify/webhooks"
```

No customer PII is retained: no names, emails, phone numbers, or addresses. Stage one stores only shop connection information; customer request/redaction webhooks acknowledge with 200 and perform no customer-data reads/writes. Shop redaction purges the shop connection. Stage-two purchase data and shop-redaction handling are described below. Product import remains a later stage.

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


## Stage two — automatic app pixel and attributed purchases

`shopify.app.toml` configures the existing public app, exact three scopes, callback origins and mandatory compliance topics. `extensions/nettmark-pixel` is an isolated Shopify Web Pixel app extension, using the strict runtime and Shopify analytics/marketing consent requirements; preferences and sale-of-data are disabled. Shopify controls loading according to customer privacy/consent. It sends nothing for purchases without a captured affiliate/campaign pair. It does not send page views to Nettmark.

On `page_viewed`, the extension captures a complete `nm_aff` (stable Nettmark UUID), `nm_camp` and `nm_src` from the page location. It preserves existing attribution on ordinary pages and does not combine partial pairs from different campaigns. A timestamped record is stored through Shopify's asynchronous localStorage API, with a seven-day cookie fallback. Both reads expire after seven days, matching redirect/tracker cookies; the older generic tracker has unexpired localStorage and is unchanged. Current `/go/{ref}` emits no click ID, so none is invented or collected.

On `checkout_completed`, a valid stored pair causes one `text/plain` JSON POST with `keepalive` and omitted credentials to `/api/shopify/pixel-events`, avoiding a CORS preflight. The only payload fields are:

- `shop_domain`, `order_id`, optional `checkout_token`, `total_value` (major currency units), `currency`, `timestamp`;
- `nm_aff`, `nm_camp`, `nm_src`;
- `line_items`, each containing only `product_id`, `variant_id`, `quantity`, `line_total` (major currency units). Product data is required by existing product-scoped commissions.

No buyer names, emails, phones, addresses, customer IDs, browser/client IDs, fingerprints, full URLs, referrers, IPs or user agents are sent or stored by this path. Incoming unknown keys are stripped at every object boundary using explicit server allowlists, including each item. The server records `source: shopify_pixel` plus the sanitized purchase data; existing internal affiliate email linkage remains server-side infrastructure, not customer PII. IPs are used transiently for rate limiting, HMAC hashed with `RATE_LIMIT_SECRET` (fallback service role key), using the existing service-only `auth_rate_limit_hit` RPC: 60 requests per IP+shop and 600 per shop per minute, failing closed on limiter errors. As with the existing auth limiter, bucket rows persist without a new cleanup job; they contain HMAC digests, never raw IPs.

The public ingress limits the streamed request to 8 KiB, validates types, bounded identifiers, nonnegative finite amounts, ISO currency and recent timestamps, and accepts only connected shops with a saved token. Unattributed input returns 202 without event/quarantine/order storage. Existing runtime identity resolution maps organic/paid/Meta IDs. Ingress additionally requires the affiliate to match the runtime affiliate, the runtime/offer business email to resolve to the connected business ID, the runtime stable business ID to agree when populated, and existing approved/active/accepted offer participation. Unresolved runtime identities use the existing quarantine helper without any purchase payload; identity/ownership/participation mismatches are dropped. Paid approval and product eligibility remain enforced by the existing processor.

The service-only `record_shopify_conversion` SQL function atomically reserves `(shop_domain, order_id)` and inserts the canonical `campaign_tracking_events` row; a failure rolls back both. Numeric/GID order aliases normalize to the numeric ID before dedupe. The new `shopify_order_conversions` table contains only IDs, shop domain and creation time, with RLS enabled and client access revoked. Duplicate orders return `200 {duplicate:true}` without a second event or processor call. No IP or user-agent is written to the event. The ingress invokes the existing `/api/process-conversion` handler locally with the event ID; it does not create a separate payout path or change commission/money semantics. **Browser pixel assertions are not server-verified orders**: no `read_orders` scope is requested, matching the existing browser track-event trust limitation. Ingest success proves event storage, not commission/payout completion. A crash or processor failure can leave a stored event awaiting operational replay; automatic recovery is not introduced here, and duplicate deliveries do not re-run the processor.

Connect now best-effort reads/creates/updates this app's Shopify web pixel after saving the store. Only `shopKey` and `ingestUrl` are pixel settings. The ingestion URL follows the existing webhook origin logic (`NEXT_PUBLIC_BASE_URL` origin, otherwise request origin) and reuses the Preview-only automation bypass helper. That Preview-only URL may contain the automation bypass value; it is browser-visible, as explicitly required for protected Preview ingestion. Do not use a production bypass or add the Shopify token/other credentials to settings. Do not log URLs/settings or request/response bodies.

Store metadata adds `pixel_id`, `pixel_status` (`active`, `inactive`, `error`), safe short `pixel_error` and `pixel_updated_at`. Missing deployed extension produces `extension_not_deployed` without failing store installation. Status exposes only safe metadata, excluding token and pixel ID. The connected card displays Tracking: Active/Not active and a turn-on/retry action. `POST /api/shopify/pixel` requires same-origin, signed-in business ownership and a connected row; activation writes guard the installation timestamp against reconnect races. Disconnect attempts pixel deletion before token revocation, then marks it inactive locally even if Shopify is unavailable. Uninstall marks inactive; Shopify removes the app pixel. Shop redaction explicitly deletes order-dedupe rows before deleting the store (also protected by a cascading foreign key). Existing financial event/payout ledgers remain intact; they contain no buyer PII from this path.

### Founder release steps (not executed)

1. Review and apply `supabase/migrations/20261110120000_shopify_stores.sql` if not already applied, then `supabase/migrations/20261110130000_shopify_pixel.sql` through the authorized migration process. The new function uses existing event columns evidenced in application code; verify the target schema before applying. Never run the undo as a forward migration. Manual undo: `supabase/undo/20261110130000_shopify_pixel.undo.sql`; disable the pixel first, since dropping dedupe history can permit duplicate orders after re-enabling. Undo preserves existing events/payouts.
2. In an environment authorized for network access, install Shopify CLI and the extension dependency (`npm install --prefix extensions/nettmark-pixel`). This checkout intentionally has no downloaded extension dependency or generated extension lockfile. The extension pins `@shopify/web-pixels-extension` to `2.18.0` (type-checked with strict TypeScript against that version).
3. From the repository root, link the existing app and deploy the app configuration/extension:

   ```sh
   shopify app config link --client-id 504d490cc8b4e692142ff5713bfa6de3
   shopify app deploy --client-id 504d490cc8b4e692142ff5713bfa6de3
   ```

   Select the existing Nettmark app, preserve/review the checked-in settings if CLI regenerates configuration, and complete Shopify's extension identity/version prompts. Confirm all callback URLs and the three compliance topics use API version `2026-10`. Shopify CLI deployment is distinct from the Next.js deployment. Extension type checks/builds happen in Shopify CLI; `extensions/` is excluded from Next.js TypeScript and repository ESLint.
4. Configure the stage-one server env above. No new mandatory env is needed; `RATE_LIMIT_SECRET` optionally separates limiter hashing from the service-role key. Confirm the existing auth limiter migration `20261027120000_auth_rate_limits.sql` is applied. For protected Preview, configure Vercel automation bypass and the exact Preview callback alias; a canonical base pointing at production sends pixel events there, so choose `NEXT_PUBLIC_BASE_URL` intentionally per environment.
5. Deploy the Next.js change through a separately authorized release. Connect a development store (or click Turn on tracking / Retry on an existing connection). Check Tracking: Active. Remove any old manual Shopify Customer Events snippet before testing the app pixel: that legacy `/api/track-event` route has no Shopify-order dedupe and running both can record duplicate purchases. No manual snippet is needed for app-pixel stores.
6. With applicable marketing/analytics consent, follow a real Nettmark `/go/{ref}` link, complete a dev checkout, and verify one sanitized event, correct campaign/affiliate/business, scoped product amount and existing processor result. Repeat delivery to confirm order dedupe; test another business/affiliate link, missing attribution, expiry, denied consent, disconnect/reconnect, uninstall and shop redact. Inspect logs/status for safe outcomes only, never payloads or tokens.

Mock-only checks: `yarn test:shopify-pixel` and `yarn test:shopify-integration`. Neither makes network/database calls. The new extension is also exercised through a mocked Shopify register/browser/analytics runtime. Live Shopify API behavior, CLI compilation, actual consent and checkout delivery remain release-time checks.
