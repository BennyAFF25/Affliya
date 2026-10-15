import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Render the actual card JSX with unresolved/positive/negative saved setup answers.
const source = readFileSync('app/affiliate/dashboard/promote/[offerId]/page.tsx', 'utf8');
const start = source.indexOf('{(!offerMetaResolved || showMetaSetupWarning) && (');
const end = source.indexOf('{showSalesPixelWarning', start);
assert.ok(start > 0 && end > start);
const expression = source.slice(start, end).trim().slice(1, -1);
const js = ts.transpileModule(`return (${expression});`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } }).outputText;
const card = new Function('React', 'offerMetaResolved', 'showMetaSetupWarning', 'metaDemandSending', 'metaDemandSent', 'requestBusinessPaidPromotion', js);
const render = (resolved: boolean, warning: boolean) => renderToStaticMarkup(card(React, resolved, warning, false, false, () => {}));
const pending = render(false, false);
const shown = render(true, true);
assert.match(pending, /aria-busy="true"/);
assert.match(pending, /Loading paid promotion setup/);
assert.match(pending, /class="invisible" aria-hidden="true"/);
assert.match(pending, /absolute inset-5/);
assert.match(shown, /aria-busy="false"/);
assert.doesNotMatch(shown, /Loading paid promotion setup/);
assert.equal(render(true, false), '');
// The complete content stays in normal flow with identical sizing while hidden.
const content = /<div(?: class="invisible")? aria-hidden="(?:true|false)">([\s\S]*?)<\/div><\/div>$/;
assert.equal(pending.match(content)?.[1], shown.match(content)?.[1]);
assert.ok(pending.match(content)?.[1]);
console.log('Paid setup first-paint skeleton preserves exact content geometry; only definitive ready setup collapses it');
