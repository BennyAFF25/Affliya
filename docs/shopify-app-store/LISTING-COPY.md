# Nettmark App Store listing — UNPUBLISHED DRAFT

Not submitted or published. Verify against current Shopify listing requirements and real review environment before submission. Do not use AppleDash branding, unsupported performance statistics, superlatives, testimonials or pricing in screenshots/image descriptions.

**Name:** Nettmark

**Subtitle:** Connect affiliate promotion with attributed storefront sales

**Introduction:** Connect your Shopify online store to Nettmark's affiliate marketplace. Let affiliates promote your business through organic content and, where you allow it, affiliate-funded advertising. Track attributed purchases in your existing Nettmark business workflows.

**Details:** Nettmark connects businesses publishing commission offers with affiliates who promote them. This connector activates Nettmark's Shopify app pixel and links attributed purchases to Nettmark campaigns. Businesses manage offers, content approvals and commissions in Nettmark. Tracking respects Shopify's customer-privacy framework and uses minimized purchase information without buyer contact details. Browser events depend on consent and do not independently verify orders. Product import is not included.

**Features:**

- Connect through Shopify authorization, then sign in or create a Nettmark business account.
- Activate app-pixel tracking and view tracking status from Nettmark My Business.
- Attribute eligible purchases to Nettmark affiliate and campaign links.
- Use product/variant line data in existing product-scoped commission rules.
- Disconnect with confirmation to remove tracking and uninstall Nettmark.

**Suggested tags:** Affiliate marketing; sales attribution; creator marketing. Final taxonomy/category selections need checking in the submission form.

**Store requirement:** Merchant must have an online store. Consent/privacy settings can prevent pixel execution. An authenticated Nettmark business account is required after Shopify authorization.

## Pricing guidance — decision required before submission

Draft disclosure: “The Shopify connector has no separate installation fee. For merchants who already have a Nettmark account, Nettmark marketplace plans and commissions are billed on Nettmark under their existing terms. Additional Nettmark marketplace charges may apply.”

**BEN'S BILLING DECISION — PLACEHOLDER, NOT CUSTOMER COPY:** Merchants who first discover Nettmark in the Shopify App Store may need a Shopify-billed path. Confirm Shopify billing eligibility/requirements, the approved billing path, plans, prices, currencies, commissions and listing disclosures before submission. This change implements no billing exception or new charging flow. Do not present the app simply as “Free to install” while omitting further charges. Do not put pricing in image descriptions.

## Screencast shot list

1. Start at the Shopify listing/admin install surface, with no existing Nettmark session. Show Shopify authorization immediately, without entering a store domain in Nettmark.
2. Accept requested scopes. Show Nettmark business login and the business signup option after the grant.
3. Sign in with the review business account (or demonstrate signup, confirmation and existing onboarding continuation). Show the already-authorized store linked without repeating the grant.
4. Show My Business, connected shop and Tracking: Active. Demonstrate retry only if needed; do not imply an undeployed extension is ready.
5. Open an authorized dev storefront via a Nettmark attribution link; apply relevant consent and complete a test checkout. Show the resulting attributed conversion in Nettmark without buyer PII.
6. Show disconnect confirmation, cancel once, then confirm; show inactive/disconnected state and fresh Shopify OAuth on reinstall.

Image descriptions should describe these screens and outcomes only, without pricing, statistics or testimonials.

## Reviewer test-instructions outline

- Supply actual draft listing/dev-store install link and authorized review environment URL. Shopify scopes must be `write_pixels,read_customer_events` only. Extension must be deployed separately before recording tracking as active.
- Supply dedicated business credentials through Shopify's private reviewer instructions, never this repository. No 2FA on that test account; verify reviewer access and any email-confirmation requirements beforehand. This change does not disable security on real accounts.
- Start installation from Shopify in a browser without a Nettmark session. Expect OAuth first, then `/login/business?next=%2Fbusiness%2Fshopify%2Fcomplete`. No Nettmark shop-domain field should appear.
- After login (or business signup and existing plan/onboarding continuation), expect My Business with the store connected and tracking active. Pending grant must be completed within one hour; start a fresh install if expired. Existing Nettmark sessions can complete directly after OAuth.
- Give a real test offer, approved test affiliate/campaign URL, consent steps, test payment/checkout instructions and exact location of the attributed event in the review environment. Do not include live payment credentials or customer PII.
- Describe tracking consent limits, pending expiry, connection ownership, disconnect confirmation and fresh OAuth on reinstall. Confirm compliance and uninstall deliveries succeed directly at the www webhook URL without a redirect.
- Resolve the billing placeholder above before providing final reviewer instructions. No claim is made that a listing, extension, migration or remote config has been deployed by this change.
