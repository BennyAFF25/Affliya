/* eslint-disable @typescript-eslint/no-explicit-any -- Minimal offline React hook harness. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import React from 'react';
const state: any[] = [];
let cursor = 0;
const store = { id: 'store', shop_domain: 'demo.myshopify.com', status: 'connected', pixel_status: 'active' };
let requests = 0;
let refreshes = 0;
const loader = Module as unknown as { _load: (name: string, ...args: any[]) => any };
const originalLoad = loader._load;
const react = { ...React, useEffect: () => {}, useState: (initial: any) => {
  const index = cursor++;
  if (!(index in state)) state[index] = initial;
  return [state[index], (value: any) => { state[index] = value; }];
} };
loader._load = function(name, ...args) {
  if (name === 'react') return { ...react, default: react, __esModule: true };
  if (name === 'next/navigation') return { useRouter: () => ({}) };
  if (name === '@headlessui/react') return { Dialog: 'dialog', DialogPanel: 'panel', DialogTitle: 'title', Description: 'description' };
  return originalLoad.call(this, name, ...args);
};
async function run() {
  const Card = (await import('../components/ShopifyConnectCard')).default;
  loader._load = originalLoad;
  const render = () => { cursor = 0; return Card({ onTrackingChange: () => refreshes++ }); };
  render();
  state[1] = [store]; state[2] = false;
  const elements = (node: any): any[] => Array.isArray(node) ? node.flatMap(elements) : node?.props ? [node, ...elements(node.props.children)] : [];
  const button = (tree: any, label: string) => elements(tree).find(node => node.type === 'button' && node.props.children === label);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { requests++; return { ok: true, json: async () => ({ stores: [] }) }; }) as any;
  try {
    button(render(), 'Disconnect').props.onClick();
    let tree = render();
    assert.equal(elements(tree).find(node => node.type === 'dialog').props.open, true);
    assert.match(JSON.stringify(tree), /uninstalls the app.*no longer be tracked/);
    button(tree, 'Cancel').props.onClick();
    tree = render();
    assert.equal(elements(tree).find(node => node.type === 'dialog').props.open, false);
    assert.equal(requests, 0);
    button(tree, 'Disconnect').props.onClick();
    elements(render()).find(node => node.type === 'dialog').props.onClose();
    assert.equal(elements(render()).find(node => node.type === 'dialog').props.open, false);
    assert.equal(requests, 0, 'dismissal also does nothing');
    button(tree, 'Disconnect').props.onClick();
    await button(render(), 'Disconnect store').props.onClick();
    assert.equal(requests, 2, 'disconnect then reload');
    assert.equal(refreshes, 1);
    assert.equal(elements(render()).find(node => node.type === 'dialog').props.open, false);
    state[1] = [store];
    button(render(), 'Disconnect').props.onClick();
    globalThis.fetch = (async (url: string) => {
      if (url.endsWith('/status')) throw new Error('mock reload failure');
      return { ok: true };
    }) as any;
    await button(render(), 'Disconnect store').props.onClick();
    assert.equal(refreshes, 2, 'successful disconnect refreshes checklist even if card reload fails');
  } finally { globalThis.fetch = originalFetch; loader._load = originalLoad; }
  console.log('Shopify disconnect confirmation tests passed');
}
void run();
