import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('app/affiliate/dashboard/promote/components/AIPromotionPackPanel.tsx', 'utf8');
const promote = readFileSync('app/affiliate/dashboard/promote/[offerId]/page.tsx', 'utf8');
const marketplace = readFileSync('app/affiliate/marketplace/page.tsx', 'utf8');
const effect = panel.slice(panel.indexOf('  useEffect('), panel.indexOf('  async function generate()'));
assert.doesNotMatch(effect, /fetch\(/, 'mount must not call the AI API');
assert.match(panel, /onClick={generate} disabled={busy}/, 'generation remains explicitly available');
for (const response of ['availability', 'response']) {
  assert.match(panel, new RegExp(`if \\(${response}\\.status === 403\\) \\{\\s*setStatus\\("AI suggestions unlock once the business approves your access"\\);\\s*return;`));
}
assert.match(promote, /participationStatus === "pending" && \([\s\S]*?<strong>Pending approval<\/strong>/);
assert.ok(promote.indexOf('<strong>Pending approval</strong>') < promote.indexOf('{mode === "ad" && (', promote.indexOf('<AIPromotionPackPanel')), 'pending notice is outside the paid-only section');
for (const param of ['sort', 'search', 'q', 'type', 'status']) assert.ok(marketplace.includes(`searchParams.get("${param}")`));
assert.match(marketplace, /recent: "Most Recent"/);
assert.match(marketplace, /offersLoading \? <span role="status">Loading offers…<\/span> : <span>Showing/);
console.log('affiliate promote and marketplace regressions passed');
