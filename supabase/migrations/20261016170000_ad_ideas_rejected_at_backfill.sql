-- Backfill rejected_at for legacy rejected proposals from proposal.rejected outbox events
-- (outbox row created in the same transaction as the status change). Only fills NULLs.
BEGIN;
UPDATE public.ad_ideas a SET rejected_at = e.first_at
FROM (SELECT entity_id, min(created_at) AS first_at FROM public.affiliate_webhook_outbox
      WHERE event_type = 'proposal.rejected' GROUP BY entity_id) e
WHERE e.entity_id = a.id::text AND a.status = 'rejected' AND a.rejected_at IS NULL
  AND a.id IN ('bee19d13-5e4d-4d91-ae1d-0e5e103b5e16','be494883-29c6-4e24-a748-ce46d8a29710','0237e3ba-949a-464b-b525-9f885dcb98d5');
COMMIT;
