import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTrybePixel, shouldLoadTrybePixel } from '../utils/marketing/trybePixel';

for (const path of ['/', '/lp/business-demo', '/lp/partner-demo', '/shop/brand', '/create-account', '/for-businesses', '/pricing', '/businesses']) {
  assert.equal(shouldLoadTrybePixel(path), true, path);
}
for (const path of [null, '', '/affiliate', '/affiliate/dashboard/manage-campaigns', '/business/manage-campaigns', '/admin/users', '/internal/marketing', '/onboarding/for-business', '/login', '/login/business', '/login-help', '/auth-redirect', '/auth/reset-password', '/logout', '/settings', '/wallet', '/dashboard', '/other/dashboard/reports', '/meta-auth-callback', '/stripe-redirect', '/go/ref', '/api/track-event']) {
  assert.equal(shouldLoadTrybePixel(path), false, String(path));
}
const scripts: any[] = [];
const doc = {
  getElementById: (id: string) => scripts.find(script => script.id === id),
  createElement: () => ({ setAttribute(name: string, value: string) { (this as any)[name] = value; } }),
  head: { appendChild: (script: any) => scripts.push(script) },
} as unknown as Document;
const win = {} as Window;
loadTrybePixel('/business/manage-campaigns', doc, win);
assert.equal(scripts.length, 0);
loadTrybePixel('/', doc, win);
loadTrybePixel('/lp/business-demo', doc, win);
loadTrybePixel('/affiliate/dashboard', doc, win);
loadTrybePixel('/create-account', doc, win);
assert.equal(scripts.length, 1, 'navigation/remount must not inject twice');
assert.equal(scripts[0].src, 'https://track.nettmark.com/pixel.js');
assert.equal(scripts[0]['data-auto-tracking'], 'false');
assert.equal(scripts[0]['data-pixel-code'], 'px_4f4f743c629f');
assert.equal(scripts[0]['data-store-id'], '1f76e30b-a49e-419f-bb2f-116385e337ac');
assert.equal(scripts[0]['data-platform'], 'CUSTOM');
assert.equal((win as any)._trybe.customDomain, 'track.nettmark.com');
assert.equal((win as any)._trybe.serviceUrl, 'https://prod-trybe-platform-6mi3j.ondigitalocean.app/attribution');

async function testPanel() {
  const require = createRequire(__filename);
  const loader = require('module');
  const originalLoad = loader._load;
  const originalFetch = globalThis.fetch;
  const originalReact = (globalThis as any).React;
  const states: any[] = [];
  let cursor = 0;
  let effect: (() => (() => void)) | undefined;
  const effects: any[] = [];
  (globalThis as any).React = React;
  loader._load = function(id: string, ...args: any[]) {
    if (id === 'react') return { ...React,
      useState(initial: any) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (value: any) => { states[i] = value; }]; },
      useRef: (value: any) => ({ current: value }),
      useEffect: (callback: any) => { if (!effect) { effect = callback; effects.push(callback); } },
    };
    return originalLoad.call(this, id, ...args);
  };
  try {
    const { AIPromotionPackPanel } = require('../app/affiliate/dashboard/promote/components/AIPromotionPackPanel');
    const render = () => { cursor = 0; return renderToStaticMarkup(React.createElement(AIPromotionPackPanel, { offerId: 'offer', mode: 'paid', hasExistingCopy: false, onApply() {} })); };
    let resolve!: (response: Response) => void;
    globalThis.fetch = (() => new Promise<Response>(done => { resolve = done; })) as typeof fetch;
    const pending = render();
    assert.match(pending, /Start with a draft/);
    assert.match(pending, /aria-busy="true"/);
    assert.match(pending, /disabled=""/);
    const cleanup = effects[0]();
    assert.equal(render(), pending, 'slow availability retains identical placeholder');
    resolve(Response.json({ available: true }));
    await new Promise(done => setImmediate(done));
    const available = render();
    assert.match(available, /aria-busy="false"/);
    assert.doesNotMatch(available, /disabled=""/);
    assert.equal(pending.match(/class="([^"]+)"/)?.[1], available.match(/class="([^"]+)"/)?.[1], 'pending and ready share reserved dimensions');
    assert.equal(pending.replace('aria-busy="true"', 'aria-busy="false"').replace(' disabled=""', ''), available, 'same header/content/wrapping prevents insertion shift');
    cleanup();
    states.length = 0; effect = undefined; effects.length = 0;
    render(); effects[0]();
    resolve(Response.json({ available: false }));
    await new Promise(done => setImmediate(done));
    assert.equal(render(), '', 'definitive unavailable response hides the card');
    states.length = 0; effect = undefined; effects.length = 0;
    const failedPlaceholder = render(); effects[0]();
    resolve(new Response(null, { status: 503 }));
    await new Promise(done => setImmediate(done));
    assert.equal(render(), failedPlaceholder, 'transient failure must not collapse reserved space');
  } finally {
    loader._load = originalLoad;
    globalThis.fetch = originalFetch;
    if (originalReact === undefined) delete (globalThis as any).React;
    else (globalThis as any).React = originalReact;
  }
}
void testPanel().then(() => console.log('Trybe route/injection and delayed draft layout tests passed')).catch(error => { console.error(error); process.exitCode = 1; });
