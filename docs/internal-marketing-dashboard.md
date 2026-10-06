# Internal marketing dashboard

## Mobile overview — October 2026

The main surface follows `docs/internal-marketing-reference.png`: Nettmark logo, compact period/menu header, four keyboard-accessible tabs, 2×2 headline cards, trial potential, a compact cohort milestone card, and transparent deterministic opportunities. This replaces the long default scroll and duplicated headline cards. Details remain available without changing reporting sources.

- Overview: website views are recorded repeat events; new businesses are the selected signup cohort; offers published are saved offer records in the activity period; trials started use existing entitlement history in the activity period. No comparison-period movements or decorative charts are invented.
- From click to campaign: views remain separate events. Business counts come from existing durable `businessFunnel.detail` flags. Rates use the same signup denominator and explicitly do not imply adjacent conversions. Campaigns here mean paid Meta runtime creation, rather than all-platform organic and paid activity.
- Trial potential uses the existing `fullConversionMonthlyAud` scenario based on current trialing state and verified configured monthly AUD price. It is not MRR or collected revenue. If unavailable, display current trial state without inventing a price.
- Opportunities count actual cohort businesses with no saved offer, a saved offer without trial history, or a trial without paid campaign creation. The largest gap is highlighted once; other gaps are listed separately. Recent signups may still progress. Partial reports suppress gap prioritisation.
- Acquisition retains audience filtering, event metric selection, real timeline, source grouping, page and CTA placement tables.
- Activation retains linked landing source/campaign filters, chronological journey, Free/Growth branches, stage and email drilldowns, cohort date/URL controls, experiment comparison, legacy milestone and gap details, plan and dashboard actions, and searchable business directory. Source/campaign state survives tab switches.
- Revenue consolidates current trial/cancellation state, configured price and potential scenarios, accrued fees by currency, and supporting affiliate/request/all-platform campaign activity.

No reporting API, analytics, billing, attribution, authentication, Meta, onboarding, database, migration or deployment configuration changed. Scoped reporting regression coverage validates durable sources, independent outcomes, empty cohorts and suppression of recommendations for partial reports. Synthetic browser checks verify the reference-specific presentation; authenticated live reporting was not exercised.


## Linked landing measurement definitions

- A visitor is a distinct random browser identity stored locally. It is an approximation of people: multiple devices, cleared storage and blocked tracking affect coverage. Storage-disabled traffic remains unlinked rather than receiving a new ID on every view.
- The period selects browsers with a recorded `/lp/business-demo` landing view in that UTC window. The earliest observed visit **within that window** determines source/campaign; this is not a lifetime first-touch model. Current landing query parameters and browser referrer take precedence over older stored marketing metadata. The request's same-site `Referer` header is not treated as the incoming acquisition source.
- Authenticated product events bridge the browser identity to verified business signup records. Accounts created before the landing view are excluded from new-account conversions. Each business links to one browser journey; a browser links to its first eligible new business. Deferred email-confirmation signups can link through subsequent authenticated onboarding.
- Ordered stages require timestamps in sequence: landing → account → onboarding → saved offer → plan screen. Free requires a confirmed server choice (`choice_confirmed: true`), with legacy confirmed outcome compatibility. Growth click → server-recorded **trial-eligible** checkout → persisted trial history are separate stages. Resuming a paid subscription is not a first-trial checkout.
- Onboarding offers require a `business_onboarding` event and a saved offer with the same ID, owner and valid creation time. General dashboard offers are excluded. Trial totals use the existing webhook-maintained `growth_trial_used` and `growth_trial_started_at` fields, so ended trials remain counted as historical starts.
- Confirmed outcomes with missing intermediate measurements remain in the detail/source totals and are explicitly identified when absent from the ordered funnel. Missing milestones indicate missing measurements or unfinished progress, not necessarily abandonment. Free and Growth observations can overlap when someone changes their choice.
- Historical events without browser identity cannot safely be converted into unique visitors or signup links. The landing detail displays their view counts and coverage limitations. Historical outcomes remain available in signup reporting.

## Secondary measurement definitions

Website events are repeated counts, not unique visitors. Account starts measure CTA events, not completed registrations. Audience filters apply to the website-detail section only. Its existing UTM/source/referrer grouping is separate from the primary funnel's fresh landing-source measurement.

Marketplace counts describe activity created during the reporting window across all businesses. Activation/dashboard behaviour describes businesses in the selected signup cohort through the observation date; independent milestones must not be interpreted as sequential conversions. Current Meta and subscription states are snapshots.

Trial potential describes trials started in the period and their current subscription/cancellation status. It is a scenario, not MRR or collected revenue. Fees sum accrued ledger entries and adjustments separately by currency; the headline shows AUD.

## Implementation and access

The existing server email allowlist, authenticated reporting API and no-index metadata remain the access boundary. Browser identity is analytics evidence only and never grants access or affects commercial attribution. New linkage is stored in existing JSON metadata; no migration or remote configuration change is required.

Relevant implementation: `app/internal/marketing/BusinessFunnel.tsx`, `page.client.tsx`, `marketing.module.css`, `app/api/marketing-events/route.ts`, `utils/marketing/landingFunnel.ts`, `visitor.ts`, `reportRows.ts` and the existing marketing/product event loggers. Handler-level onboarding/plan tracking replaces the global label-based plan listener in `components/analytics/BusinessProductAnalytics.tsx`; its dashboard tracking remains intact. The existing onboarding Reddit conversion remains the sole onboarding external conversion path.

Read-only production schema verification on 2026-10-06 confirmed the fields and permitted business event types. The live product-event constraint includes business milestones missing from the checked-in August constraint; this schema-history drift remains documented, not silently migrated.

Reporting paginates 1,000 rows at a time up to the existing explicit 5,000-row cap. Sources reaching that cap are named as partial reports; a source/page failure produces an error rather than invented zeroes. Pagination is not a transactional database snapshot. No account records or production statistics are copied into the source tree.

## Validation

- `yarn -s tsx scripts/marketing-dashboard.test.ts`
- `yarn -s tsx scripts/marketing-funnel.test.ts`
- `yarn -s tsc --project tsconfig.marketing.json`
- Production build plus scoped lint with modern JSX/styled-jsx rule overrides for the repository's legacy lint configuration.
- Desktop/mobile/tablet rendering and interaction checks with synthetic data; production theme CSS is included. Authenticated live onboarding, checkout and dashboard inspection require an authorised session and were not exercised against production.

The scoped workflow covers reporting, visitor linkage, affected onboarding/plan pages and shared analytics helpers. The legacy signup page still has unrelated Supabase typing errors and is not added to the focused typecheck; full-repository type checking reports those separately. Next.js builds skip type/lint validation, so build success alone does not establish those checks passed.

The trial-first cohort report and landing journey retain separate underlying sources and date scopes. This UI refactor does not change either builder or the reporting API.
