# Segment B operator recovery (not executed)

Apply reviewed migration before deploying the refund caller. The additive migration relies on Segment A accounts/availability and the existing currency metadata columns. Existing RLS, Meta auth, campaigns and AUD units are unchanged. No automatic pending expiration is safe.

DDL dry run: submit `scripts/segB-migration.dry-run.sql` as one staging Management API query. It contains the exact forward DDL inside BEGIN/ROLLBACK. Then, after separately applying the real migration in staging, edit and run `scripts/segB-refund.dry-run.sql` to validate reservation, duplicate rejection, release, retry and single debit. These scripts were prepared, not executed. Undo removes only Segment B objects, refuses unresolved pending attempts and preserves completed financial history. Revert application callers before undo; do not discard recovery records before reconciling.

Read-only recovery queries:

```sql
SELECT *, 'wallet_refund:' || id::text AS stripe_idempotency_key
FROM public.wallet_refund_attempts WHERE status='pending' ORDER BY created_at;
SELECT transfer_batch_id, sum(amount) AS amount_aud,
       array_agg(id ORDER BY id) AS settlement_ids,
       array_agg(stripe_transfer_id) AS recorded_transfer_ids
FROM public.ad_spend_settlements
WHERE transfer_batch_id IN (
  SELECT transfer_batch_id FROM public.ad_spend_settlements WHERE status='transfer_processing'
)
GROUP BY transfer_batch_id;
```

Refund: inspect Stripe request logs using `wallet_refund:<attempt UUID>`, and refund metadata `refund_attempt_id`. A timeout can occur after Stripe accepted the request. An operator may replay the **identical** original request using this same key while Stripe retains it, never a new key; reconstruct the original charge and metadata from request logs. Do not replay beyond Stripe's key retention window (at least 24 hours); absence from a list is not proof of failure. Resolve via Stripe evidence/support first. A crash before the call also leaves pending; verify no accepted operation before release. Accepted but still pending Stripe refunds stay pending with their Stripe refund ID saved. No webhook currently finalizes these attempts: periodically reconcile their actual status.

After verified success, call `finish_wallet_refund` with attempt UUID, status `succeeded`, actual Stripe refund/charge IDs and actual currency `aud`. It atomically inserts audit history and finalizes the existing debit; repeat calls are harmless. For a verified terminal failure/cancellation, call with status `failed`, actual refund ID if known and an explanatory `p_error`; this releases exactly the reservation once. For uncertainty, leave pending. If finalization fails, keep the attempt pending and repair/retry finalization, never create another refund. Do not use legacy `record_wallet_refund` for Segment B attempts: it would debit again.

Transfer: `transfer_batch_id` is the stable operation UUID; Stripe key is `ad_spend_transfer_batch:<UUID>`, transfer_group `ad_spend_batch:<UUID>`, with matching metadata. Query **all** batch rows, including succeeded rows, because a completion write may partially succeed. The intended amount is the sum of all rows bearing that UUID, not just remaining processing rows. Never reset accepted/unknown rows to a retryable state or invoke a new batch for them. Use Stripe logs/metadata and the recorded transfer IDs to find the original transfer. If accepted, update remaining `transfer_processing` rows in that batch to `transfer_succeeded` with that transfer ID, clear errors/retry scheduling, and check the update result. If verified rejected before acceptance, release only processing rows to `transfer_failed`, clear batch ID and schedule retry. For ambiguous outcomes retain processing; do not expire claims. Replay only the identical original request/key within retention, subject to the same caution as refunds.

The runtime releases explicit Stripe 4xx rejections only; connection/timeouts, 5xx, idempotency conflicts and post-acceptance database failures retain claims. If release itself fails, the claim remains recoverable. Failures known to occur before submitting the money operation release the claim too. This favours reconciliation over duplicate money movement. Existing ledger-application crash gaps are outside Segment B.

Concurrency test: follow `scripts/segA-concurrent-holds.sql`, sending the two companion SQL files as separate overlapping requests. Both intentionally raise exceptions to roll back. No Node/service-environment script is needed. The PASS/error messages are the expected result, not HTTP success.
