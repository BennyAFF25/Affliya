import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/business/my-business/connect-meta/page.tsx', 'utf8');
const callback = readFileSync('app/api/meta/callback/route.ts', 'utf8');
const saveRoute = readFileSync('app/api/business/offers/[offerId]/meta-assets/route.ts', 'utf8');

assert.match(page, /Attach Meta assets to offers/);
assert.match(page, /meta_page_id/);
assert.match(page, /meta_page_name/);
assert.match(page, /meta_ad_account_id/);
assert.match(page, /meta_ad_account_name/);
assert.match(page, /meta_pixel_id/);
assert.match(page, /meta_pixel_name/);
assert.match(page, /\/api\/business\/offers\/\$\{encodeURIComponent\(offer\.id\)\}\/meta-assets/);
assert.doesNotMatch(page, /\.from\("offers"\)\s*\n\s*\.update\(/);
assert.match(page, /Attach assets to continue/);
assert.match(page, /\/api\/meta\/get-datasets/);
assert.match(page, /state=/);
assert.match(callback, /safeRedirectFromState/);
assert.match(callback, /searchParams\.get\('state'\)/);
assert.match(callback, /\/business\/my-business\/connect-meta\?connected=1/);
assert.match(saveRoute, /\.from\("offers"\)/);
assert.match(saveRoute, /\.update\(updatePayload\)/);
assert.match(saveRoute, /meta_page_id: metaPageId/);
assert.match(saveRoute, /meta_ad_account_id: metaAdAccountId/);
assert.match(saveRoute, /saved/);

console.log('connect-meta asset mapping tests passed');
