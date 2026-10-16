import assert from 'node:assert/strict';
import { createLedgerDriftHandler } from '../utils/wallet/ledgerDriftCron';
import type { LedgerDriftClient } from '../utils/wallet/ledgerDrift';
import { GET } from '../app/api/cron/ledger-drift/route';

async function main() {
  const oldSecret = process.env.CRON_SECRET;
  const originalError = console.error;
  console.error = () => {};
  try {
    let created = 0;
    let writes: Record<string, any>[] = [];
    let pages: unknown[][] = [];
    let selectError = false, insertError = false, throws = false;
    let failOffset = -1;
    const offsets: number[] = [];
    const handler = createLedgerDriftHandler(() => {
      created++;
      if (throws) throw new Error('private client failure');
      return { from(table: string) {
        if (table === 'money_flow_audit_log') return { insert: async (row: Record<string, any>) => {
          writes.push(row);
          return { error: insertError ? { message: 'private insert error' } : null };
        } };
        assert.equal(table, 'wallet_ledger_reconciliation');
        const query = {
          select: () => query,
          eq: (key: string, value: boolean) => { assert.equal(key, 'has_drift'); assert.equal(value, true); return query; },
          order: () => query,
          range: async (offset: number, end: number) => {
            assert.equal(end, offset + 999); offsets.push(offset);
            return { data: pages.shift() || [], error: selectError || offset === failOffset ? { message: 'private SELECT error' } : null };
          },
        };
        return query;
      } } as unknown as LedgerDriftClient;
    });
    const request = (auth?: string) => new Request('http://localhost/api/cron/ledger-drift', {
      headers: auth ? { authorization: auth } : {},
    });
    process.env.CRON_SECRET = 'test-secret';
    for (const auth of [undefined, 'Bearer wrong', 'bearer test-secret', 'Bearer tést-secret']) {
      assert.equal((await handler(request(auth))).status, 401);
    }
    assert.equal(created, 0);
    delete process.env.CRON_SECRET;
    assert.equal((await handler(request('Bearer test-secret'))).status, 401);
    assert.equal((await GET(request())).status, 401); // real route rejects before any client/env use
    assert.equal(created, 0);
    process.env.CRON_SECRET = 'test-secret';
    const run = () => handler(request('Bearer test-secret'));
    let response = await run();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, driftCount: 0, audited: 0 });
    assert.equal(writes.length, 0);
    const row = { affiliate_email: 'test@example.invalid', currency: 'AUD', canonical_minor: '100',
      ledger_minor: '90', drift_minor: '-10', has_drift: true, canonical_floor_applied: false,
      floor_explanation: 'Diagnostic' };
    pages = [[row]];
    response = await run();
    assert.equal(response.status, 200);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].event_type, 'shadow_ledger_drift_detected');
    assert.equal(writes[0].severity, 'warning');
    assert.equal(writes[0].source_route, '/api/cron/ledger-drift');
    assert.deepEqual(writes[0].metadata.drift_rows, [row]);
    writes = [];
    offsets.length = 0;
    pages = [Array(1000).fill(row), [row]];
    response = await run();
    assert.deepEqual(await response.json(), { ok: true, driftCount: 1001, audited: 1 });
    assert.deepEqual(offsets, [0, 1000]);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].metadata.drift_rows.length, 100);
    assert.equal(writes[0].metadata.truncated, true);
    writes = [];
    pages = [[{ ...row, floor_explanation: 'x'.repeat(65000) }]];
    await run();
    assert.equal(writes[0].metadata.drift_count, 1);
    assert.deepEqual(writes[0].metadata.drift_rows, []);
    assert.equal(writes[0].metadata.truncated, true);
    writes = [];
    selectError = true;
    response = await run();
    assert.equal(response.status, 500);
    assert.equal(writes.length, 0);
    assert.deepEqual(await response.json(), { error: 'Wallet ledger drift check failed' });
    selectError = false;
    failOffset = 1000;
    pages = [Array(1000).fill(row), [row]];
    assert.equal((await run()).status, 500);
    assert.equal(writes.length, 0); // Never audit a partial scan as a successful run.
    failOffset = -1;
    insertError = true;
    pages = [[row]];
    assert.equal((await run()).status, 500);
    assert.equal(writes.length, 1);
    throws = true;
    assert.equal((await run()).status, 500);
    console.log('ledger-drift: auth, healthy/drift, pagination, caps, SELECT/INSERT/client failures passed');
  } finally {
    console.error = originalError;
    if (oldSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldSecret;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
