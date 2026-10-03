# Affiliate onboarding V1 — branch testing guide

## Behavior
Entry: /create-account?role=affiliate -> /onboarding/for-partners.
Affiliate signup asks for email and password; business signup retains the business name.
An offerId UUID and optional mode=ad in the signup URL survive the confirmation destination. The affiliate's own missing profile can be recovered after email verification; existing roles are never overwritten.
The onboarding chooser uses user-scoped offers and requests, excludes inactive/rejected/unknown participation states, and hides private offers unless the affiliate already has approved access.
Approved participation ranks first, then open offers with preapproved organic assets. No first-party offer is selected or joined automatically.
The affiliate explicitly joins an open offer or requests business approval. Pending access does not unlock Promote; another offer can be chosen while waiting.
Continuing or explicitly exploring the dashboard sets onboarding_completed only. It does not mean a campaign was approved, published or generated traffic.
Organic is the default with no ad spend. Paid remains a visible option. Neither requires payout setup to prepare a proposal.
An empty content library selects the existing own-content form after a successful library load. Text-only organic drafts use the existing reviewed organic submission path; paid proposals still require media.
The dashboard's first-promotion card follows an approved marketplace offer rather than Nettmark's own programme. Activation tasks are offer access, approved promotion readiness and actual tracked traffic. Withdrawals still use existing payout setup.

## AI setup
No remote configuration was changed. AI is disabled by default and hidden until ALL of these server environment variables are valid:
- NETTMARK_AFFILIATE_AI_ENABLED=true
- OPENAI_API_KEY (server only; never NEXT_PUBLIC)
- UPSTASH_REDIS_REST_URL (HTTPS)
- UPSTASH_REDIS_REST_TOKEN (server only)

Optional server settings:
- OPENAI_PROMOTION_MODEL (default gpt-4.1-mini; confirm availability for the configured OpenAI project)
- NETTMARK_AI_DAILY_USER_LIMIT (default 3 attempts/day; maximum accepted 10)
- NETTMARK_AI_DAILY_GLOBAL_LIMIT (default 100 attempts/day; maximum accepted 1000)

Use isolated preview credentials/quota storage when testing. Configure the OpenAI project's own spend budget/alerts. Missing/failed quota storage fails closed before generation. One atomic Lua command reserves user/global UTC-day counters and an in-flight lock across server instances. Failed attempts count; limits bound calls, not an exact monetary amount. The lock expires in 40 seconds and only its originating nonce can release it. Keep the feature flag off until provider and limiter are configured.

Generate with AI lives above the existing Promote form. Requires session, affiliate role, a currently active and visible offer, and approved participation. The client sends mode and optional selected creative ID, never a pasted business brief. Server data includes offer title/description/headline/bio/website, saved business name and up to three active, correctly owned/scoped, mode-eligible captions/audience/location examples. Websites and media are not fetched. Customer data, financial records, commissions, self-reported performance, Meta tokens and emails are excluded.
Provider: bounded native-fetch OpenAI Responses request, strict seven-field JSON, store=false, 25-second timeout and runtime validation. Refusal, incomplete output, invalid structures and provider failures preserve current copy. Logs contain duration/status/token counts only.
All seven fields are previewed. Apply changes only the relevant text fields and explicitly confirms replacement when copy already exists. The panel must not apply a response after navigating away. It does not create campaign rows, links, funds, approval or publication. AI-applied organic text always uses the reviewed submission path, even if it coincidentally matches preapproved text.
Packs are temporary. Copy the pack to retain all fields; applied copy is saved through existing submission records. No AI history table, migration, dependency, Pro entitlement, billing or new price. Existing provider retention policies still apply despite store=false.
Later Pro packaging/history/batch operations require a separate product decision. This release's small free beta allowance is an operational cap, not a paid-tier promise.

## Manual acceptance
1. Fresh affiliate: signup without a public name; confirm email if required; land in the chooser. Repeat with an offerId and mode=ad. Confirm a business account keeps its existing role and cannot join as an affiliate.
2. Open offer: explicitly choose/join; land in that offer's organic Promote page, not the first-party offer. Refresh and revisit; participation remains singular through the existing join helper.
3. Approval-required: explicit request stays pending, no pack or launch. Choose another open offer. Rejected/inactive offers cannot be continued; private offers are hidden without existing approval.
4. No offers / search no matches / failed list read: clear empty/error states and dashboard or retry action. Accept terms before continuing.
5. No brand content: own organic copy can be submitted for review; paid still asks for media. Failed library access does not masquerade as an empty usable library.
6. AI off: manual Promote works, no provider call. AI on: all seven fields, saved context labels, three hooks and useful offer-specific copy; check product facts, affiliate disclosure and absence of fabricated claims.
7. Existing edited copy: generation never changes it; Apply asks before replacement. Change mode or leave during generation; no stale copy is applied.
8. Edited/AI organic captions and email/forum methods display review wording and submit pending. Only untouched preapproved social brand content takes the existing ready path. Paid submissions remain proposals for business review.
9. Hit daily limit or simulate quota/provider outage, refusal, timeout/malformed output: no campaign/funding changes, editable form and existing copy remain.
10. Existing affiliate dashboard: first-promotion card follows their marketplace brand; payout setup is accessible in settings, not a first activation requirement. Business completion alone retains business conversion/cookie behavior.

## Validation and limits
The session has a GitHub connector but no editable checkout, terminal or browser. The branch workflow runs mocked HTTP/API/provider/quota regression cases, strict typechecking and ESLint for new feature code, and compares existing integration diagnostics with the immutable main base. Integration baseline errors are reported rather than claimed fixed. The checked-in Database type contains only an example users table; it is not authoritative schema.
Preview browser acceptance, live RLS/DDL/population and real provider availability have not been verified here. Existing Supabase schema/approval helpers are reused without migrations. Core read/auth errors fail closed; missing optional business profile name is allowed with clearly limited context.
Relevant repository instructions/context: AGENTS.md; docs/VISION.md, PRODUCT_PRINCIPLES.md, PRODUCT.md, BUSINESS_RULES.md, ARCHITECTURE.md, UI_DESIGN_SYSTEM.md, DATABASE.md, MONEY_FLOW.md, TRACKING.md, META_ADS.md and DECISIONS.md. Canonical styles were inspected in MobileBusinessOverview.tsx, mobile-business.css, Business Overview integration and globals.css. Localized dark/cyan cards follow that reference without global theme edits.
Known existing differences: preapproved organic readiness checks differ from the reviewed path; existing product event calls include values not present in older migration constraints; historical first-party onboarding docs describe the replaced flow. This feature preserves existing launch/payment authority and does not claim to repair those separate paths.
