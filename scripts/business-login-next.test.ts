import assert from 'node:assert/strict';
import { safeBusinessReturnTo, businessContinuationDestination } from '../utils/safeBusinessReturnTo';
import { businessLoginDestination } from '../utils/businessLoginDestination';

async function run() {
  const next = '/business/payouts?filter=pending#history';
  assert.equal(safeBusinessReturnTo(next), next);
  for (const value of ['https://evil.test', '//evil.test', '/business/../../evil', '/business/\\evil', '/business/ok\npath', '/business/' + 'a'.repeat(501)]) {
    assert.equal(safeBusinessReturnTo(value), null, value);
  }
  assert.equal(safeBusinessReturnTo('/business/my-business/ad-ideas?proposal=12345678-1234-1234-1234-123456789abc'), '/business/my-business/ad-ideas/12345678-1234-1234-1234-123456789abc');
  assert.equal(businessContinuationDestination('/business/my-business', next), next);
  assert.equal(businessContinuationDestination('/business/choose-plan', next), '/business/choose-plan?next=' + encodeURIComponent(next));
  const onboarding = new URL(businessContinuationDestination('/onboarding/for-business?subscription=processing', next), 'https://offline.test');
  assert.equal(onboarding.searchParams.get('subscription'), 'processing');
  assert.equal(onboarding.searchParams.get('next'), next);
  assert.equal(businessContinuationDestination('/business/my-business', '//evil.test'), '/business/my-business');
  const originalFetch = globalThis.fetch;
  try {
    for (const required of [false, true]) {
      for (const onboardingCompleted of [false, true]) {
        globalThis.fetch = async () => Response.json({ required, onboardingCompleted });
        const result = await businessLoginDestination(next);
        const url = new URL(result, 'https://offline.test');
        if (required) assert.equal(url.pathname, '/business/choose-plan');
        else if (!onboardingCompleted) assert.equal(url.pathname, '/onboarding/for-business');
        else assert.equal(result, next);
        if (required || !onboardingCompleted) assert.equal(url.searchParams.get('next'), next);
      }
    }
    globalThis.fetch = async () => Response.json({ required: false, onboardingCompleted: true });
    assert.equal(await businessLoginDestination('//evil.test'), '/business/dashboard');
    globalThis.fetch = async () => Response.json({ required: false, onboardingCompleted: false });
    assert.equal(await businessLoginDestination(), '/business/dashboard', 'no-next login routing remains unchanged');
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(businessLoginDestination(next), /Could not verify/);
  } finally { globalThis.fetch = originalFetch; }
  console.log('business login next tests passed');
}
void run();
