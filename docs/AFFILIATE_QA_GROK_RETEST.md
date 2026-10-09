# Read-only affiliate retest prompt

Use after the release has deployed; record the exact URL, time, viewport and affiliate account identifier without exposing private email addresses/tokens.

```text
Run a read-only QA pass of Nettmark's deployed affiliate portal on desktop and mobile (390px and 320px). Use my existing affiliate session. Do not modify code, database, Meta, Stripe, settings, offers or campaigns. Do not submit proposals/requests, send messages, top up/refund wallets, accept terms, start subscriptions or launch/pause ads. Reading pages can invoke the application's existing analytics; do not add events manually.

Record PASS / FAIL / NOT TESTABLE for:
1. Inbox: no missing-table error after migrations; genuine empty inbox is distinct from query failure. If safe request blocking is available, block only the inbox read and verify a visible error/retry, never a misleading empty state. Do not mark/archive messages.
2. Counts: Manage Campaigns pending proposals equal all saved paid/organic proposals still awaiting approval, INCLUDING viewed ones. Compare with Submitted Reviews (pending + viewed-awaiting-review; exclude approved/rejected). Dashboard approved offers match My Shop. Dashboard active campaigns match Manage Campaigns regardless of chart date filters.
3. Promote: open offer f29a1ae8-b083-43f1-a808-55a659365697 in both Submit Ad and Submit Organic. Brand content must finish with content, "No brand content yet", or a visible error/retry within approximately 10 seconds. No invalid Meta updated_at query. Change modes and switch between brand/upload sources; no stuck spinner or lost entered copy.
4. Submitted Reviews: View details opens a read-only saved proposal, not the editor. Check creative, headline, caption, CTA, destination/tracking URL, budget, schedule, targeting, placements, status and viewed timestamp. Missing legacy fields must say not saved/not applicable. Opening details must not mark it viewed by the business.
5. Offer data: HouseDesk 9d61f440-d4b9-49ee-a2f1-84c75db9693b must preview its own housedesk.co.uk destination. Slow content-readiness must not hold the whole offer screen. Navigate quickly between offers; no previous offer's link/data. Description appears once when bio repeats it. Partner Programme type is populated or omitted. Check displayed full URLs; Everbond's existing incomplete URL remains an unresolved data issue until the correct destination is supplied.
6. Polish: support uses contact@nettmark.com, no VS Code text, one accordion +/- indicator. Zero refundable wallet balance must not say funds are clear. Offer money shows its own currency code (AUD/USD/GBP); starter funding shows AUD. Wallet retains current checkout currency behavior pending ledger audit; do not assume currency conversion or an AUD migration occurred. Launch guidance is plain.
7. Session: inspect recovery behavior if the existing session expires naturally while a draft is open: copy and selected files remain, re-login link opens a new tab, no automatic submission. Do not manipulate production tokens or submit to test this; mark refresh/failure/same-account write checks NOT TESTABLE and request the automated fixture results.

Also check existing Featured/Most recent marketplace sorting, search/filter/pagination, onboarding back-to-offers navigation, and mobile horizontal overflow. Do not mutate persistent settings while checking.

Report exact reproduction steps, expected vs actual behavior, affected route, sanitized console/network error, severity and screenshot if available. Distinguish migrations not yet applied, existing Everbond data, and unverified financial/backend behavior from code regressions. Do not claim success just because the console is quiet.
```
