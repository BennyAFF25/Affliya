# Personal marketing dashboard

## Design brief

A private workspace for one person checking Nettmark's marketing performance. Use Apple's restrained visual language: warm silver canvas, white panels, system typography, fine borders and one blue accent. Keep the overview compact and let detailed information unfold below it.

- Four summary metrics: website views, new businesses, new affiliates and accrued AUD fees.
- Acquisition: actual hourly/daily events, audience filters, source grouping, page performance and CTA placements.
- Activation: signup-cohort milestones, recorded gaps, plan choices, trials and dashboard actions.
- Businesses: searchable recent signups with progress and recorded activity.
- Responsive layout, keyboard focus, readable empty/error states, chart data table and reduced-motion support.

## Metric definitions

Website events are repeated event counts, not unique visitors. Account starts measure CTA clicks. Marketing events do not establish signup attribution. Acquisition audience filters apply to counts, sources, pages, placements and the chart together.

Marketplace counts include activity created during the reporting window, across all businesses. Activation and dashboard behavior use businesses that signed up during that window. Milestone percentages share the signup cohort denominator; independent milestones are not treated as sequential conversions.

Trial potential uses trials started in the selected period and their current subscription/cancellation status. It is a conversion scenario, not MRR or collected revenue. Fee totals sum accrued ledger entries, including adjustments, by currency; the headline shows AUD only.

UTC defines all periods and bucket labels. A source query failure produces an error instead of invented zeroes. Sources reaching the 5,000-row query limit are named in the report. Current Meta connections and subscription statuses are snapshots.

## Implementation and checks

The existing server email allowlist, authenticated API and no-index metadata remain the access boundary. The redesign is isolated to the internal dashboard and its reporting response; event ingestion is unchanged.

Run `yarn -s tsx scripts/marketing-dashboard.test.ts` and `yarn -s tsc --project tsconfig.marketing.json`. The scoped workflow runs both checks on the implementation branch and matching pull requests. Preview rendering still needs an allowed signed-in account.

Production data is loaded at runtime through the existing authenticated endpoint. No account records or marketing statistics are copied into the source tree.
