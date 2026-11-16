# Shopify integration

Repository draft only. No Shopify deployment, live app configuration, production environment change or remote migration is included. Production environment variables and `shopify app deploy` / config pushes still require explicit founder instruction and have **not** been done.

The optional connector lives in Business → My Business → Setup access / Readiness checklist. Product import is unimplemented. Billing, offer approvals, attribution/commission processing and tracking-readiness rules remain unchanged. A connected shop cannot be taken by another business; a fresh Shopify grant can reassign disconnected/uninstalled shops.

## Installation and account continuation

Shopify's application URL is `https://www.nettmark.com/api/shopify/install`. A Shopify launch with `shop` and `hmac` validates HMAC and immediately redirects to the authorization-code grant, with no required Nettmark login/UI beforehand. Invalid install HMAC returns 401. Every launch/reinstall starts OAuth, even when a shop row already exists.

State is signed for ten minutes, bound to shop and a timing-safe httpOnly nonce cookie. It contains either **both** user/business IDs or explicit nulls for both. Partial/malformed bindings are rejected. A previously bound user/business cannot be replaced by a different session. OAuth callback validates HMAC, state, nonce, age and shop before exchange. The nonce cookie clears on callback success/failure.

After scope acceptance, the callback exchanges the code for expiring offline credentials. With an eligible Nettmark business session and matching prior binding (or an unbound state), it connects immediately, registers uninstall via GraphQL and activates the pixel, then redirects to `/business/my-business?shopify=connected`. Session/ownership checks remain server-side.

Without a session the grant is encrypted into service-role-only `shopify_pending_installs`: opaque random ID, shop, optional original user/business binding, encrypted token pair, scopes, expiries and creation time. No buyer PII. The browser gets only a signed opaque ID in an httpOnly, SameSite=Lax cookie (Secure in production), never a token. The grant is usable for one hour. It redirects to `/login/business?next=%2Fbusiness%2Fshopify%2Fcomplete`; that login offers `/create-account?role=business&next=%2Fbusiness%2Fshopify%2Fcomplete`. Signup/confirmation and the existing plan/onboarding gates retain the validated `/business/` continuation. This does not introduce a second auth or billing system.

`GET /business/shopify/complete` requires the existing business session, atomically consumes the pending grant, validates expiry and any original binding, and applies the same ownership/conditional-write checks as an immediate connect. It registers the webhook, activates tracking and lands on My Business. Missing/expired/replayed grants yield safe `pending_expired`. Failure after consumption requires a fresh install. No-session retries retain the cookie/grant and go back to business login. Completion/error clears the pending cookie. Expired pending records cannot be used; physical cleanup occurs on subsequent installs, completion attempts and applicable uninstall/redact webhooks. There is no deployed periodic cleanup job in this change; arrange periodic service-only expired-row cleanup if a strict physical retention deadline is required.

### Nettmark-initiated connect: Shopify-owned entrypoint

The card has **no shop-domain input**. Its Connect Shopify store link goes to `/api/shopify/install` without a shop parameter, which redirects to the confirmed official Shopify App Store listing URL configured in server-only `SHOPIFY_APP_STORE_URL` (HTTPS `apps.shopify.com` only). Shopify selects/knows the shop and launches the application URL; OAuth above follows immediately.

**Required configuration still missing:** the repository contains a client ID but no verified public/draft listing handle. Set `SHOPIFY_APP_STORE_URL` to the exact listing URL supplied by the Dev Dashboard before enabling this path. It is intentionally blank in `.env.example`; the code fails closed with `configuration` instead of inventing a listing or restoring a text field. Exact destination used: the configured official App Store listing URL, not an undocumented client-ID picker. Mock tests use `https://apps.shopify.com/mock-listing` solely as a fixture, never a production destination.

Research: [Shopify staff guidance for public apps without a shop URL](https://community.shopify.dev/t/oauth-process-without-shop-url/26665) directs merchants to their App Store listing and states the centralized admin authorize endpoint is internal and unsuitable. [Official access-scope documentation](https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes) documents `https://admin.shopify.com/store/{STORE_NAME}/oauth/install?client_id={CLIENT_ID}` with an already-known store, not a generic picker. No documented domain-free generic client-ID picker was verified; the listing URL needs founder confirmation.

## Setup and repo-only TOML

Public non-embedded authorization-code app; client ID `504d490cc8b4e692142ff5713bfa6de3`. `embedded = false`; API version `2026-10`. The draft explicitly sets `access_scopes.use_legacy_install_flow = true` for the requested URL-parameter authorization-code flow. [Shopify app configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#access_scopes) documents that omitting it selects managed installation; the supported legacy option matches this standalone implementation. Production-intent callback allowlist:

- `https://www.nettmark.com/api/shopify/callback`
- `https://nettmark.com/api/shopify/callback`

The former Preview callback and localhost are removed from production-intent TOML. Use a separate explicitly authorized development configuration for local/Preview callbacks; do not push this draft to the live app. OAuth redirects preserve request origin and nonce/session host binding. Start real installs on www. The server canonicalizes Nettmark apex to www for webhook/pixel URLs. Canonical webhook/pixel origin should be `https://www.nettmark.com` (`NEXT_PUBLIC_BASE_URL`); apex redirects must not be used for webhook delivery.

| Server variable | Purpose |
| --- | --- |
| `SHOPIFY_CLIENT_ID` | Existing public app client ID |
| `SHOPIFY_CLIENT_SECRET` | OAuth and webhook HMAC secret |
| `SHOPIFY_STATE_SECRET` | Optional independent signing key, fallback client secret |
| `SHOPIFY_TOKEN_ENCRYPTION_KEY` | Existing random 32-byte AES key, base64 or 64 hex characters |
| `SHOPIFY_SCOPES` | Exactly `write_pixels,read_customer_events` |
| `SHOPIFY_API_VERSION` | `2026-10` |
| `SHOPIFY_APP_STORE_URL` | Confirmed official `https://apps.shopify.com/<listing-handle>`; not yet known in repo |
| `NEXT_PUBLIC_BASE_URL` | Canonical www origin for webhooks/pixel; OAuth retains request origin |
| Supabase URL, service role and public anon key | Existing server/session configuration; never expose service role |

No `read_products`, `read_orders` or customer/PII scopes. Extra implied returned scopes are accepted, but both requested scopes must be granted. Keep encryption keys secure; rotation requires a planned migration or reconnection. Status returns an explicit safe metadata projection, never token columns; RLS/revoked client grants cover both connection and pending tables.

## Expiring offline tokens and schema rollout

[Shopify's migration guide](https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens) requires new public apps to request expiring tokens. Code exchange sends `application/x-www-form-urlencoded` with `client_id`, `client_secret`, `code`, `expiring=1`. Both access and refresh credentials are encrypted with the existing versioned AES-256-GCM helper. `expires_in` and `refresh_token_expires_in` are converted to absolute `access_token_expires_at` / `refresh_token_expires_at` timestamps; plaintext credentials are server-only and never logged.

`lib/shopify/tokens.ts` returns valid access credentials before Admin API work, refreshing within sixty seconds of expiry using form-encoded `grant_type=refresh_token`. It stores the returned pair/expiries together before use, coalesces same-process refreshes and uses conditional writes across workers so refresh cannot overwrite a reconnect/disconnect. A losing writer rereads the current valid saved token. Invalid/expired refresh credentials clear tokens, mark disconnected/inactive and require fresh OAuth (`reauth_required`). Transient upstream failures keep credentials for retry but do not use stale access. Pixel retry, install-time registration/activation and disconnect pixel deletion/uninstall use this helper.

Apply separately in order, only when authorized:

1. `supabase/migrations/20261110120000_shopify_stores.sql`
2. `supabase/migrations/20261110130000_shopify_pixel.sql`
3. `supabase/migrations/20261114120000_shopify_review_readiness.sql`

The new forward migration adds refresh ciphertext/expiry columns and the service-only pending table. A `NOT VALID` connected-token constraint preserves legacy rows without a data rewrite while enforcing full token pairs on new inserts/updates. Legacy connected rows lack refresh credentials and must reauthorize; the helper disconnects them before further Admin API use. Roll out SQL before new application code. After all legacy stores reauthorize/disconnect, constraint validation can be separately planned. No schema was applied or inspected remotely.

Manual rollback: `supabase/undo/20261114120000_shopify_review_readiness.undo.sql`. Roll back application code first; it deletes pending grants and refresh columns but retains original access ciphertext. Legacy application code cannot refresh retained expiring access tokens, which will expire (typically within an hour); rollback does not restore permanent tokens. Reapply the forward schema and reconnect before running expiring-token code again. The undo is destructive, lives outside migrations and must **never** be run as a forward migration. Earlier manual undo scripts remain separate.

## Disconnect and webhook lifecycle

`POST /api/shopify/disconnect` retains same-origin, business ownership and confirmation requirements. It best-effort deletes the app pixel, then invokes [GraphQL `appUninstall`](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/appUninstall), the [official REST-uninstall equivalent](https://shopify.dev/changelog/posts/new-appuninstall-mutation-to-allow-apps-to-uninstall-themselves). No REST revoke remains. Versioned GraphQL POST uses the existing 15-second timeout and rejects redirects; transport, top-level GraphQL and mutation user errors are failures. Local disconnect still completes if remote operations fail, clearing both tokens/expiries and marking tracking inactive.

TOML declares both compliance topics and uninstall at the direct www HTTPS endpoint:

```toml
[webhooks]
api_version = "2026-10"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://www.nettmark.com/api/shopify/webhooks"

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "https://www.nettmark.com/api/shopify/webhooks"
```

Connect-time `webhookSubscriptionCreate(APP_UNINSTALLED)` remains a best-effort complement. Compliance topics cannot be registered through the Admin API. Configured subscriptions must be released separately; repo TOML is not proof of live registration.

`POST /api/shopify/webhooks` checks exact raw-byte HMAC before dispatch (401 for invalid HMAC), strict shop header (400), and returns 503 on transient processing failures for retries. Customer data-request/redact and unknown topics return 200 without reading/storing buyer data. Bodies and credentials are never logged. `shop/redact` deletes pending grants, order-dedupe rows and connection. Uninstall clears credentials/tracking then deletes the eligible connection (order dedupe cascades) and older pending grants. It uses `X-Shopify-Triggered-At` (invalid/missing falls back to now) and only touches connections installed before that event, protecting newer reinstalls. Repeated deliveries succeed. Financial event/commission ledgers remain; no buyer PII is added and no commission reversal occurs.

On protected Preview only, existing `VERCEL_AUTOMATION_BYPASS_SECRET` handling can append a URL-encoded bypass query for automatically registered callback URLs. Never print the secret or resulting URL. Production/development do not append it. Compliance test subscriptions for protected Preview require separately authorized configuration; production subscriptions use www without a redirect.

## Validation and remaining release work

Mock-only suites: `yarn test:shopify-integration`, `yarn test:shopify-pixel`, `node --import tsx scripts/shopify-disconnect-confirm.test.ts`; typecheck and changed-file ESLint. Tests stub all Shopify/database calls and never contact live services. See the completed implementation plan for actual results.

Before review, separately authorize staging migration/env/config/extension release, confirm the App Store listing URL, and resolve Ben's billing decision in [listing draft](shopify-app-store/LISTING-COPY.md). Privacy/cookie additions are an [unpublished draft](shopify-app-store/PRIVACY-SHOPIFY-SECTION.md), not live policy changes. Live dev-store verification still needs: anonymous Shopify install → OAuth first → login/signup continuation → connected/tracking active; wrong-session/ownership/replay/expiry failures; expiring token refresh; disconnect including revoke failure; reinstall; signed compliance/uninstall retries; delayed-uninstall protection; buyer-PII absence; unchanged tracking readiness and financial processing. Review credentials should have no 2FA and be supplied privately. No live verification is claimed here.

## Stage two — automatic app pixel and attributed purchases

`shopify.app.toml` configures the existing public app, exact two scopes, callback origins and mandatory compliance topics. `extensions/nettmark-pixel` is an isolated Shopify Web Pixel app extension, using the strict runtime and Shopify analytics/marketing consent requirements; preferences and sale-of-data are disabled. Shopify controls loading according to customer privacy/consent. It sends nothing for purchases without a captured affiliate/campaign pair. It does not send page views to Nettmark.

On `page_viewed`, the extension captures a complete `nm_aff` (stable Nettmark UUID) and `nm_camp` from the page location. It preserves existing attribution on ordinary pages and does not combine partial pairs from different campaigns. A timestamped record is stored through Shopify's asynchronous localStorage API, with a seven-day cookie fallback. Both reads expire after seven days, matching redirect/tracker cookies; the older generic tracker has unexpired localStorage and is unchanged. Current `/go/{ref}` emits no click ID, so none is invented or collected.

On `checkout_completed`, a valid stored pair causes one `text/plain` JSON POST with `keepalive` and omitted credentials to `/api/shopify/pixel-events`, avoiding a CORS preflight. The only payload fields are:

- `shop_domain`, `order_id`, `total_value` (major currency units), `currency`, `timestamp`;
- `nm_aff`, `nm_camp`;
- `line_items`, each containing only `product_id`, `variant_id`, `quantity`, `line_total` (major currency units). Product data is required by existing product-scoped commissions.

No buyer names, emails, phones, addresses, customer IDs, browser/client IDs, fingerprints, full URLs, referrers, IPs or user agents are sent or stored by this path. Incoming unknown keys are stripped at every object boundary using explicit server allowlists, including each item. The server records `source: shopify_pixel` plus the sanitized purchase data; existing internal affiliate email linkage remains server-side infrastructure, not customer PII. IPs are used transiently for rate limiting, HMAC hashed with `RATE_LIMIT_SECRET` (fallback service role key), using the existing service-only `auth_rate_limit_hit` RPC: 60 requests per IP+shop and 600 per shop per minute, failing closed on limiter errors. As with the existing auth limiter, bucket rows persist without a new cleanup job; they contain HMAC digests, never raw IPs.

The public ingress limits the streamed request to 8 KiB, validates types, bounded identifiers, nonnegative finite amounts, ISO currency and recent timestamps, and accepts only connected shops with a saved token. Unattributed input returns 202 without event/quarantine/order storage. Existing runtime identity resolution maps organic/paid/Meta IDs. Ingress additionally requires the affiliate to match the runtime affiliate, the runtime/offer business email to resolve to the connected business ID, the runtime stable business ID to agree when populated, and existing approved/active/accepted offer participation. Unresolved runtime identities use the existing quarantine helper without any purchase payload; identity/ownership/participation mismatches are dropped. Paid approval and product eligibility remain enforced by the existing processor.

The service-only `record_shopify_conversion` SQL function atomically reserves `(shop_domain, order_id)` and inserts the canonical `campaign_tracking_events` row; a failure rolls back both. Numeric/GID order aliases normalize to the numeric ID before dedupe. The new `shopify_order_conversions` table contains only IDs, shop domain and creation time, with RLS enabled and client access revoked. Duplicate orders return `200 {duplicate:true}` without a second event or processor call. No IP or user-agent is written to the event. The ingress invokes the existing `/api/process-conversion` handler locally with the event ID; it does not create a separate payout path or change commission/money semantics. **Browser pixel assertions are not server-verified orders**: no `read_orders` scope is requested, matching the existing browser track-event trust limitation. Ingest success proves event storage, not commission/payout completion. A crash or processor failure can leave a stored event awaiting operational replay; automatic recovery is not introduced here, and duplicate deliveries do not re-run the processor.

Connect now best-effort reads/creates/updates this app's Shopify web pixel after saving the store. Only `shopKey` and `ingestUrl` are pixel settings. The ingestion URL follows the existing webhook origin logic (`NEXT_PUBLIC_BASE_URL` origin, otherwise request origin) and reuses the Preview-only automation bypass helper. That Preview-only URL may contain the automation bypass value; it is browser-visible, as explicitly required for protected Preview ingestion. Do not use a production bypass or add the Shopify token/other credentials to settings. Do not log URLs/settings or request/response bodies.

Store metadata adds `pixel_id`, `pixel_status` (`active`, `inactive`, `error`), safe short `pixel_error` and `pixel_updated_at`. Missing deployed extension produces `extension_not_deployed` without failing store installation. Status exposes only safe metadata, excluding token and pixel ID. The connected card displays Tracking: Active/Not active and a turn-on/retry action. `POST /api/shopify/pixel` requires same-origin, signed-in business ownership and a connected row; activation writes guard the installation timestamp against reconnect races. Disconnect attempts pixel deletion before token revocation, then marks it inactive locally even if Shopify is unavailable. Uninstall deletes eligible connection/dedupe rows; Shopify removes the app pixel. Shop redaction explicitly deletes order-dedupe rows before deleting the store (also protected by a cascading foreign key). Existing financial event/payout ledgers remain intact; they contain no buyer PII from this path.

### Founder release steps (not executed)

1. Review and apply `supabase/migrations/20261110120000_shopify_stores.sql` if not already applied, then `supabase/migrations/20261110130000_shopify_pixel.sql` and `supabase/migrations/20261114120000_shopify_review_readiness.sql` through the authorized migration process. The new function uses existing event columns evidenced in application code; verify the target schema before applying. Never run the undo as a forward migration. Manual undo: `supabase/undo/20261110130000_shopify_pixel.undo.sql`; disable the pixel first, since dropping dedupe history can permit duplicate orders after re-enabling. Undo preserves existing events/payouts.
2. In an environment authorized for network access, install Shopify CLI and the extension dependency (`npm install --prefix extensions/nettmark-pixel`). The extension has its own checked-in package lock; do not change its configured UID. The extension pins `@shopify/web-pixels-extension` to `2.18.0` (type-checked with strict TypeScript against that version).
3. From the repository root, link the existing app and deploy the app configuration/extension:

   ```sh
   shopify app config link --client-id 504d490cc8b4e692142ff5713bfa6de3
   shopify app deploy --client-id 504d490cc8b4e692142ff5713bfa6de3
   ```

   Select the existing Nettmark app, preserve/review the checked-in settings if CLI regenerates configuration, and complete Shopify's extension identity/version prompts. Confirm both callback URLs and all compliance/uninstall subscriptions use the direct www URI and API version `2026-10`. Shopify CLI deployment is distinct from the Next.js deployment. Extension type checks/builds happen in Shopify CLI; `extensions/` is excluded from Next.js TypeScript and repository ESLint.
4. Configure the stage-one server env above. No new mandatory env is needed; `RATE_LIMIT_SECRET` optionally separates limiter hashing from the service-role key. Confirm the existing auth limiter migration `20261027120000_auth_rate_limits.sql` is applied. For protected Preview, configure Vercel automation bypass and the exact Preview callback alias; a canonical base pointing at production sends pixel events there, so choose `NEXT_PUBLIC_BASE_URL` intentionally per environment.
5. Deploy the Next.js change through a separately authorized release. Connect a development store (or click Turn on tracking / Retry on an existing connection). Check Tracking: Active. Remove any old manual Shopify Customer Events snippet before testing the app pixel: that legacy `/api/track-event` route has no Shopify-order dedupe and running both can record duplicate purchases. No manual snippet is needed for app-pixel stores.
6. With applicable marketing/analytics consent, follow a real Nettmark `/go/{ref}` link, complete a dev checkout, and verify one sanitized event, correct campaign/affiliate/business, scoped product amount and existing processor result. Repeat delivery to confirm order dedupe; test another business/affiliate link, missing attribution, expiry, denied consent, disconnect/reconnect, uninstall and shop redact. Inspect logs/status for safe outcomes only, never payloads or tokens.

Mock-only checks: `yarn test:shopify-pixel` and `yarn test:shopify-integration`. Neither makes network/database calls. The new extension is also exercised through a mocked Shopify register/browser/analytics runtime. Live Shopify API behavior, CLI compilation, actual consent and checkout delivery remain release-time checks.

## Tracking readiness and dev-store QA notes

The My Business checklist requires a connected Shopify store with `pixel_status: active`, or a real non-Shopify merchant tracking event for the offer within the last seven days (among the latest 50 events). A website/site_host, Meta pixel ID, onboarding flag, or synthetic setup-button `test_pixel` event alone is not evidence of an installed Nettmark tracker. Historical Shopify purchases do not keep disconnected/uninstalled/inactive stores ready. Recent manual telemetry is bounded evidence, not a live reachability guarantee. The display no longer writes inferred tracking readiness into onboarding progress; existing historical flags and publication/approval gate heuristics remain unchanged.

In Shopify admin, **Settings → Customer events** shows a single **Pixels** list, with no separate App pixels / Custom pixels tabs. The app pixel entry is named **Nettmark**.

On development/password-protected storefronts, the first visit through a tracking link lands on the password page and drops the `nm_` parameters. Unlock the storefront, then reopen the original tracking link before testing attribution. This affects only dev/password-protected stores.

## Shopify recurring billing (staging preparation, November 2026)

App Store-first anonymous grants completed through the pending install flow can claim Shopify billing when there is no Stripe subscription/customer/history, reservation or grandfathering. Nettmark-initiated connections retain Stripe. `business_entitlements.billing_provider` selects the provider; existing rows default to Stripe. Choose plan supports Free (cancel Shopify Growth first) and Growth (merchant approval URL). Confirmation and HMAC-authenticated `app_subscriptions/update` events re-query Admin GraphQL with refreshed credentials; query parameters and webhook payloads never grant access. Uninstall cancels only Shopify entitlements with the existing installation timestamp guard.

`shopBillingPreferences { currency }` is queried before creating Growth. AUD stores use `SHOPIFY_GROWTH_PRICE_AMOUNT` (default 49.00 AUD); other stores use USD with an explicitly configured positive `SHOPIFY_GROWTH_PRICE_USD_AMOUNT`. Missing/invalid USD pricing returns `growth_unavailable_currency`; Free remains available. Choose plan displays the AUD reference price and Shopify confirms the final amount and currency. Growth is EVERY_30_DAYS, unlike Stripe's calendar month, with a 14-day trial once per business. Charges remain test unless both VERCEL_ENV=production and SHOPIFY_BILLING_TEST=false. Confirm configured price/currency parity before release. No environment/configuration has been applied.

Mutations have durable serialization. A pending approval reuses its stored URL. An uncertain create/cancel or persistence failure leaves mutation_pending set; do not blindly clear it or recreate a charge. An operator must inspect the shop's active subscriptions, reconcile the stored GID/status/trial and only then release the lock (separately authorized database work). A missing known GID or unknown active subscription fails closed. No automated recovery from ambiguous external mutation outcomes is claimed.

See [billing plan](../plans/active/shopify-billing.md) for scope, rollback and the unresolved usage/platform-fee proposal. Recurring billing alone does not resolve fee compliance for existing Stripe Connect settlement. Live dev-store validation and App Store review remain outstanding.

Legacy trial-column DDL is absent from the repository even though Stripe code uses it. Shopify records its own consumed trial in shopify_app_subscriptions; a new trial requires explicit unused legacy history and unused Shopify history. Missing legacy evidence fails closed to no trial. Verify those existing fields/history in staging before release. An abandoned Stripe checkout reservation conservatively keeps that business on Stripe.

Rollout order: the migration MUST be applied before deploying this code because `getBusinessEntitlement` now selects `billing_provider`. No migration or deployment was performed here.

Shopify now recommends Shopify App Pricing (managed pricing in Partner Dashboard) for new public apps. Requirement 1.2 accepts either managed pricing or Billing API. This implementation uses Billing API/manual pricing to integrate provider isolation and existing entitlements; retaining it versus adopting managed pricing is a founder release decision (custom control versus Dashboard-managed pricing/lifecycle).

After uninstall, a business without a connected store or ACTIVE/FROZEN/PENDING Shopify subscription can use Stripe checkout; the locked reservation records a `business_subscription_status_synced` event with metadata `{source: billing_provider_change, from, to}` (the events table check constraint allows only existing event types). App Store reinstall without Stripe history claims Shopify again and returns to Choose plan for fresh approval. Trial history survives uninstall. Reconciliation uses `business_subscription_status_synced`, matching Stripe; duplicate observations do not duplicate audit events. Pending plan mutations return empty 503 webhook responses for retry; successful handling returns 200.

Stripe recovery carries consumed Shopify trial evidence into `growth_trial_used` under the entitlement lock. Checkout reads trial history after reservation; the read-only plan context also suppresses another trial before reservation.
