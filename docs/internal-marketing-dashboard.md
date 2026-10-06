# Internal marketing dashboard

## Approved direction

On 2026-10-06 the founder approved a business-funnel-first layout and explicitly requested Nettmark's dark branding. This replaces the earlier light/silver/blue internal dashboard brief. Follow the canonical Business Overview's dark neutral surfaces, cyan accent, rounded cards, system typography and restrained borders. Commercial flows, prices, permissions and commission attribution are unchanged.

## Page hierarchy

1. **Business journey:** `/lp/business-demo` tracked landing visitors, saved onboarding offers, plan-page visits and confirmed Growth trials. Source/campaign filters apply to the complete primary journey. Ordered stages and separate Free/Growth branches reveal progression, with drilldowns to linked businesses and UTC milestone times.
2. **Progress detail:** missing next milestones, onboarding step openings, publication attempts and failures. Opening a step is not proof that its fields were completed. Retries can produce both failure and success observations.
3. **Source performance and linked businesses:** first observed landing source/campaign in the selected period; distinct browsers and confirmed outcomes. Email search and milestone filters expose underlying linked accounts.
4. **Website detail and secondary platform activity:** broader repeated website events, audience filters, page/placement activity, affiliates, marketplace activity and accrued fees.
5. **All signups and business directory:** independent signup-cohort milestones and historical activity, including businesses that cannot be linked to this landing page. These are not the ordered landing funnel.

## Primary measurement definitions

- A visitor is a distinct random browser identity stored locally. It is an approximation of people: multiple devices, cleared storage and blocked tracking affect coverage. Storage-disabled traffic remains unlinked rather than receiving a new ID on every view.
- The period selects browsers with a recorded `/lp/business-demo` landing view in that UTC window. The earliest observed visit **within that window** determines source/campaign; this is not a lifetime first-touch model. Current landing query parameters and browser referrer take precedence over older stored marketing metadata. The request's same-site `Referer` header is not treated as the incoming acquisition source.
- Authenticated product events bridge the browser identity to verified business signup records. Accounts created before the landing view are excluded from new-account conversions. Each business links to one browser journey; a browser links to its first eligible new business. Deferred email-confirmation signups can link through subsequent authenticated onboarding.
- Ordered stages require timestamps in sequence: landing → account → onboarding → saved offer → plan screen. Free requires a successful response from choosing Free, recorded with `outcome: confirmed`. Growth click → server-recorded **trial-eligible** checkout → persisted trial history are separate stages. Resuming a paid subscription is not a first-trial checkout.
- Onboarding offers require a `business_onboarding` event and a saved offer with the same ID, owner and valid creation time. General dashboard offers are excluded. Trial totals use the existing webhook-maintained `growth_trial_used` and `growth_trial_started_at` fields, so ended trials remain counted as historical starts.
- Confirmed outcomes with missing intermediate measurements remain in the headline/source totals and are explicitly identified when absent from the ordered funnel. Missing milestones indicate missing measurements or unfinished progress, not necessarily abandonment. Free and Growth observations can overlap when someone changes their choice.
- Historical events without browser identity cannot safely be converted into unique visitors or signup links. The page displays their view counts and coverage limitations prominently. Historical outcomes are available in secondary signup reporting.

## Secondary measurement definitions

Website events are repeated counts, not unique visitors. Account starts measure CTA events, not completed registrations. Audience filters apply to the website-detail section only. Its existing UTM/source/referrer grouping is separate from the primary funnel's fresh landing-source measurement.

Marketplace counts describe activity created during the reporting window across all businesses. Secondary activation/dashboard behaviour describes businesses signed up during that window and events recorded within it; independent milestones must not be interpreted as sequential conversions. Current Meta and subscription states are snapshots.

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

## Main integration — 6 October 2026

Integrated with the newer trial-first onboarding on main. The primary landing journey uses `landingFunnel`; the existing immutable signup cohort `businessFunnel` and its observation controls remain available. Current onboarding view events, persisted server offer events, confirmed server Free choices, checkout eligibility, and entitlement trial history drive the journey. Existing onboarding retries, checkout verification, live pricing, and signup instrumentation are preserved. Landing-period reads are independent of signup cohort filters. No database, migration, remote configuration, or commercial flow changes were introduced by this integration.
