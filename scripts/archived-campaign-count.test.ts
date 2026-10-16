import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Workspace from '../components/business/ManageCampaignsWorkspace';
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const props = {
  audience: 'affiliate' as const, loading: false, pendingLoading: false,
  pendingCount: 0, rejectedCount: 3, unsettledSpend: 0, pendingContent: null,
  loadError: null, metaCurrency: 'AUD', onPauseOrganic() {}, onStopMeta() {},
  campaigns: [{ id: 'paused', _source: 'meta' as const, status: 'paused' }],
  syncingById: {}, onRefresh() {}, onSyncSpend() {},
};
const html = renderToStaticMarkup(React.createElement(Workspace, props));
assert.match(html, /Archived<\/p><p[^>]*>4<\/p>/);
assert.match(html, /Paused, stopped and rejected/);
const business = renderToStaticMarkup(React.createElement(Workspace, { ...props, audience: 'business', shopPlacements: [] }));
assert.match(business, /Archived<\/p><p[^>]*>1<\/p>/);
assert.doesNotMatch(business, /Paused, stopped and rejected/);
const unknown = renderToStaticMarkup(React.createElement(Workspace, { ...props, rejectedCount: null }));
assert.match(unknown, /Archived<\/p><p[^>]*>—<\/p>/);
console.log('Archived metric: affiliate rejected totals, business count and loading state passed');
