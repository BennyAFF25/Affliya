-- OWNER-RUN ONLY. Review downstream activity before undo. Retain backup for audit.
BEGIN;
LOCK TABLE public.organic_posts, public.live_campaigns IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ops_private.organic_posts_backup_20261112_000000 b JOIN public.organic_posts p ON p.id=b.post_id WHERE b.applied AND (p.campaign_id IS DISTINCT FROM b.post_id OR p.status IS DISTINCT FROM 'approved')) THEN
    RAISE EXCEPTION 'Post changed since backfill; manual review required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.campaign_tracking_events e JOIN ops_private.organic_posts_backup_20261112_000000 b ON e.campaign_id::text=b.post_id::text WHERE b.applied AND b.created_campaign) THEN
    RAISE EXCEPTION 'Campaign has downstream events; manual reconciliation required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clicks c JOIN ops_private.organic_posts_backup_20261112_000000 b ON c.campaign_id::text=b.post_id::text WHERE b.applied AND b.created_campaign) THEN
    RAISE EXCEPTION 'Campaign has clicks; manual reconciliation required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organic_posts p JOIN ops_private.organic_posts_backup_20261112_000000 b ON p.campaign_id=b.post_id WHERE b.applied AND b.created_campaign AND p.id<>b.post_id) THEN
    RAISE EXCEPTION 'Campaign is linked by another post; manual review required';
  END IF;
END $$;
UPDATE public.organic_posts p SET campaign_id=b.prior_campaign_id,status=b.prior_status
FROM ops_private.organic_posts_backup_20261112_000000 b WHERE p.id=b.post_id AND b.applied;
DELETE FROM public.live_campaigns lc USING ops_private.organic_posts_backup_20261112_000000 b
WHERE lc.id=b.post_id AND b.applied AND b.created_campaign;
UPDATE ops_private.organic_posts_backup_20261112_000000 SET applied=false WHERE applied;
COMMIT;
