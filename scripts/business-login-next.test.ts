import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { safeBusinessReturnTo, businessContinuationDestination } from '../utils/safeBusinessReturnTo';
import { businessLoginDestination } from '../utils/businessLoginDestination';

// Execute the actual page callbacks with browser/session dependencies stubbed.
function pageCallback(path: string, name: string) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (!callback && name === 'useEffect' && ts.isCallExpression(node) && node.expression.getText(source) === name) callback = node.arguments[0];
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) callback = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback, `${name} exists in ${path}`);
  return ts.transpileModule(`(${callback.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}

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
  const dismiss = pageCallback('app/onboarding/for-business/page.tsx', 'dismissOnboarding');
  for (const value of [next, null, '//evil.test']) {
    const routes: string[] = [];
    runInNewContext(dismiss, {
      session: null, returnTo: safeBusinessReturnTo(value),
      router: { push: (path: string) => routes.push(path) },
    })();
    assert.deepEqual(routes, [value === next ? next : '/business/dashboard']);
  }
  const existingSessionEffect = pageCallback('app/login/business/page.tsx', 'useEffect');
  async function checkExistingSession(search: string, role: string | null, cancel = false) {
    const routes: string[] = [];
    const errors: string[] = [];
    let destinationCalls = 0;
    const cleanup = runInNewContext(existingSessionEffect, {
      window: { location: { search } }, URLSearchParams, safeBusinessReturnTo,
      setReturnTo: () => {}, setError: (error: string) => errors.push(error),
      supabase: { auth: { getSession: async () => ({ data: { session: role === null ? null : { user: { id: 'user-id' } } } }) } },
      getAccountRole: async (id: string) => { assert.equal(id, 'user-id'); return role; },
      businessLoginDestination: async (value: string | null) => { destinationCalls++; return businessLoginDestination(value); },
      router: { replace: (path: string) => routes.push(path) },
    })();
    if (cancel) cleanup();
    await new Promise(resolve => setImmediate(resolve));
    return { routes, errors, destinationCalls };
  }
  const originalFetch = globalThis.fetch;
  try {
    for (const required of [false, true]) {
      for (const onboardingCompleted of [false, true]) {
        globalThis.fetch = async () => Response.json({ required, onboardingCompleted });
        const result = await businessLoginDestination(next);
        const existing = await checkExistingSession('?next=' + encodeURIComponent(next), 'business');
        assert.deepEqual(existing.routes, [result], 'existing sessions preserve post-login gates');
        assert.deepEqual(existing.errors, []);
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
    for (const search of ['', '?next=//evil.test', '?returnTo=' + encodeURIComponent(next), '?next=//evil.test&returnTo=' + encodeURIComponent(next)]) {
      const expected = search.includes('returnTo=') ? '/onboarding/for-business?next=' + encodeURIComponent(next) : '/business/dashboard';
      assert.deepEqual((await checkExistingSession(search, 'business')).routes, [expected]);
    }
    for (const role of ['affiliate', '', null]) {
      const result = await checkExistingSession('?next=' + encodeURIComponent(next), role);
      assert.deepEqual(result, { routes: [], errors: [], destinationCalls: 0 });
    }
    assert.deepEqual((await checkExistingSession('', 'business', true)).routes, [], 'unmounted pages do not redirect');
    globalThis.fetch = async () => new Response(null, { status: 503 });
    const failedSession = await checkExistingSession('', 'business');
    assert.deepEqual(failedSession.routes, []);
    assert.deepEqual(failedSession.errors, ['Login failed. Please try again.']);
    await assert.rejects(businessLoginDestination(next), /Could not verify/);
  } finally { globalThis.fetch = originalFetch; }
  console.log('business login next tests passed');
}
void run();
