import { timingSafeEqual } from 'node:crypto';
import { scanWalletLedgerDrift, type LedgerDriftClient, type LedgerDriftRow } from './ledgerDrift';

export function createLedgerDriftHandler(createClient: () => LedgerDriftClient) {
  return async (req: Request) => {
    const secret = process.env.CRON_SECRET || '';
    const actual = req.headers.get('authorization') || '';
    const expected = secret ? 'Bearer ' + secret : '';
    if (!expected || Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      const client = createClient();
      const rows: LedgerDriftRow[] = [];
      let bytes = 2;
      const driftCount = await scanWalletLedgerDrift(client, row => {
        const rowBytes = Buffer.byteLength(JSON.stringify(row)) + 1;
        if (rows.length < 100 && bytes + rowBytes <= 64000) {
          rows.push(row);
          bytes += rowBytes;
        }
      });
      if (driftCount > 0) {
        console.error('[ledger-drift] Shadow ledger drift detected', { driftCount, sampledRows: rows.length });
        const { error } = await client.from('money_flow_audit_log').insert({
          event_type: 'shadow_ledger_drift_detected',
          severity: 'warning',
          source_route: '/api/cron/ledger-drift',
          entity_type: 'wallet_ledger_reconciliation',
          reason_code: 'SHADOW_LEDGER_DRIFT_DETECTED',
          message: 'Shadow ledger differs from canonical wallet balances; diagnostic only.',
          metadata: { drift_count: driftCount, drift_rows: rows, truncated: driftCount > rows.length },
        });
        if (error) throw new Error('Drift audit INSERT failed');
      }
      return Response.json({ ok: true, driftCount, audited: driftCount > 0 ? 1 : 0 }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      // Do not expose raw database errors, credentials or wallet identities.
      console.error('[ledger-drift] Drift check failed');
      return Response.json({ error: 'Wallet ledger drift check failed' }, { status: 500 });
    }
  };
}
