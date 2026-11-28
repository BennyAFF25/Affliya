# Shopify billing rule check (14 November 2026, Australia/Adelaide)

Question: can Nettmark list a **free** Shopify app that only connects a store to Nettmark, while brands who signed up on nettmark.com keep paying on Stripe, without implementing the Shopify Billing API / Shopify App Pricing?

## Short answer

**Partly, but not as a complete substitute for Shopify billing.**

- Brands who find Nettmark on nettmark.com, choose a plan, and **then** connect Shopify can usually **stay on Stripe**. Shopify staff have confirmed this for connector apps.
- That does **not** make a free App Store listing with only Stripe billing compliant. If the app is public (or unlisted) on the App Store, Shopify requires a **Shopify-billed path for merchants who first discover and install the app from the App Store**. Calling it a “free connector” does not change that. The requirement applies to the **full service the merchant accesses through the app**, not just the connector layer.
- Official docs do not create an exemption for “merchants sign up off-Shopify.” The only official exemption is if **Shopify has notified you otherwise** (written agreement / granted exception).
- Listing the app as simply **“Free to install”** is risky if a merchant cannot use the connector without paying on Nettmark. Shopify’s listing form does have a field for “charges that are billed outside of Shopify's app billing system,” but that is a disclosure field, not permission to bill the core paid service only on Stripe.

## Exact official text

### App Store requirement 1.2

Source: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (fetched 14 Nov 2026)

> #### 1.2 Bill through the Shopify Billing API or Shopify App Pricing
>
> Apps that use off-platform billing cannot be distributed through the Shopify App store, unless you've been notified otherwise by Shopify. Your app must use Shopify App Pricing or the Shopify Billing API for all app charges and be free of billing related errors.
>
> 1.2.1 Use Shopify App Pricing or the Shopify Billing API.
>
> Apps that use off-platform billing cannot be distributed through the Shopify App store. Your app must use Shopify App Pricing or the Shopify Billing API for any app charges.
>
> 1.2.2 Implement Shopify App Pricing or the Shopify Billing API correctly.
>
> If your app has any charges, it must correctly implement Shopify App Pricing or the Shopify Billing API to ensure that it can accept, decline and request approval for charges again on reinstall.
>
> 1.2.3 Allow pricing plan changes.
>
> Your app must allow merchants to upgrade and downgrade their pricing plan without having to contact your support team or having to reinstall the app. This includes ensuring that the charges are successfully processed in the application charge history page in the merchant admin.

### About billing for your app

Source: https://shopify.dev/docs/apps/launch/billing

> All apps published on the Shopify App Store are required to use a Shopify provided billing solution and adhere to the terms and conditions of the Shopify Partner Program Agreement.
>
> Shopify App Pricing is available for free, monthly and annual recurring, and various usage-based plan types.

New public apps are told to use Shopify App Pricing as the default.

### Partner Program Agreement (last updated 27 February 2026)

Source: https://www.shopify.com/partners/terms

Part C, “Use of the Shopify Billing Resource”:

> Unless otherwise agreed to by Shopify in writing, if a Developer will create and issue charges to Merchants relating to the Merchants’ use or installation of the Developer’s Application, whether in the form of monthly subscription fees, cost-per-acquisition, cost-per-click, **percentage commission** or otherwise, Developer must use the Shopify Billing Resource.

Later (App Developers):

> All App Developers that create and issue charges to Merchants for the Merchant’s use of the Developer’s Application must use the Shopify Billing Resource unless otherwise agreed to by Shopify in writing.

And:

> For App Developers who obtain Shopify’s express written permission to forego use of the Shopify Billing Resource, the App Developer will submit payments due under the App Plan to Shopify monthly by way of wire transfer or Automated Clearing House (ACH).

So even an approved exemption usually still owes Shopify its revenue share, paid manually.

“Percentage commission” is explicitly in the agreement. That does not automatically mean affiliate commissions must go through Shopify Billing, but it is unhelpful if we argue that commission charges are outside the rule.

### Listing / pricing language

Sources:

- Requirement 4.2: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- Best practices, “C. Pricing”: https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices

4.2.1: “Ensure your pricing information includes all pricing options such as, free trial time and charge details.” Pricing must appear only in Pricing details, not in the icon or screenshots (4.2.2–4.2.3).

Best practices:

> Choose your primary billing method (Free to install, Recurring charge, or One-time payment) and provide clear pricing information in the designated section only.

> For apps with free and paid plans, select Recurring charge and mark one plan as Free—this shows "Free plan available" in search results.

The official example of listing pricing details includes:

> A link to a page that describes any charges that are billed outside of Shopify's app billing system.

There is **no** official primary label “Free to install, external charges apply.” The safe official pattern, if Shopify billing is implemented for App Store merchants, is a primary method of **Free to install** (only if the app and the service it provides can actually be used for free) or **Recurring charge** with a Free plan plus paid plans, plus the “charges billed outside Shopify” link for any remaining external charges that Shopify has allowed (for example, existing Stripe customers).

## How Shopify staff apply this to free connector + external SaaS

These are Partner community staff replies, not the requirement text itself. They are the current practical interpretation reviewers follow.

1. [Billing clarification for standalone SaaS with a free Shopify connector app](https://community.shopify.dev/t/billing-clarification-for-standalone-saas-with-a-free-shopify-connector-app/37417) (4 September 2026), Kyle Giesbrecht (Shopify staff), marked accepted. This is almost exactly Ben’s question.

   Asker: (1) merchant signs up and pays on the SaaS site first, then installs the free connector — can they stay on Stripe? (2) merchant finds the app in the App Store, installs, then wants a paid plan — that customer should be billed through Shopify, even though the app is “just a connector.”

   Staff:

   > your understanding of both billing scenarios is correct, and this is a common setup we see with connector apps.
   >
   > When your app is public and listed on the App Store, there has to be a path for merchants to discover, install, and pay for it through Shopify. The fact that your app is a connector rather than a full feature set doesn’t change this. The requirement applies to the full service the merchant accesses through the app, not just the connector layer.

2. Other 2026 staff threads say the same for unlisted apps, and that existing customers generally need not be migrated, while new App Store merchants need a Shopify-billed path. Exemptions are requested by putting a justification at the top of Test Instructions (often ~7 business days). Staff have said exemptions are generally for models Shopify Billing cannot support, third-party-owned billing, or categories such as print-on-demand, shipping labels, donations, and **ad spend**. A multi-platform SaaS that owns its own billing is “not typically one of those cases.” Checking an “already exempt” box without a grant is not valid.

3. Older staff wording (Partners Support Question): “If the merchant can’t use the app without signing up on a different surface, then it’s not a free app, and it shouldn’t appear on a marketplace as ‘free’.”

Do not treat Klaviyo / Mailchimp listing language as a precedent. Staff have said each app is reviewed on its own setup.

## Exemption conditions (official + practical)

Official condition in 1.2 and the Partner Agreement: only if Shopify has **notified / agreed in writing**. There is no automatic exemption for:

- “free connector”
- “merchants already chose a plan on our site”
- “we are a standalone SaaS”
- “unlisted / limited visibility”

Practical path to ask: put the justification at the very top of the submission’s Test Instructions. Do not tick an exemption checkbox unless Shopify has already granted it.

Possible arguments for Nettmark (not guaranteed):

- Most money movement is **affiliate commissions** and **ad-spend reimbursements**, not a Shopify-app subscription. Ad spend has been cited as a possible exemption category. The Partner Agreement still lists “percentage commission” among charges that normally must use the Billing Resource.
- Existing Nettmark brands should stay on Stripe (this part is already well supported by staff, even without an exemption).

A full exemption so that **App Store-first** brands also pay only on Stripe is the weaker ask.

## What this means for Nettmark

Ben is right about the usual path: a brand who finds Nettmark normally, picks a plan, and later connects Shopify is an existing Nettmark customer. Staff say those customers can stay on Stripe.

The risk is the other path: a brand who installs from the Shopify App Store first, then is sent to nettmark.com to create an account and add a billing method. For a public or unlisted listing, reviewers are likely to treat that as off-platform billing of the service the app provides, and fail 1.2.1, even if the listing says “Free to install.”

Recommended commercial shape if we want a public or unlisted listing:

1. Keep existing / site-acquired Nettmark brands on Stripe.
2. Give App Store-acquired merchants a Shopify App Pricing (or Billing API) path for whatever they must pay to use Nettmark through the app.
3. On the listing, do not present the app as unconditionally free. Use “Free to install” only if there is a genuinely usable free path. Otherwise use Recurring / usage plans (a Free plan is allowed alongside paid ones), put all prices in Pricing details, and use the official “charges billed outside of Shopify's app billing system” link for Stripe charges that apply to pre-existing Nettmark accounts, if Shopify accepts that split.
4. If we will not build Shopify billing yet, use **custom distribution** (per-store install links, no App Store review, no 1.2). That cannot later be converted to a public listing. Or submit and request an exemption in Test Instructions, accepting a likely delay and a possible no.

Nothing in this finding changes production billing. Implementing Shopify App Pricing is a founder decision.
