-- OWNER-RUN ONLY. Not executed by Codex. Review script dry run first.
-- Edit explicit IDs below. Older candidates require explicit opt-in in this SQL too.
-- Organic has no card/application subscription gate. Legacy DB triggers still fail closed.
-- Uses the same fields, readiness heuristic and stable identity as approveOrganicPost.
BEGIN;
CREATE SCHEMA IF NOT EXISTS ops_private;
REVOKE ALL ON SCHEMA ops_private FROM PUBLIC, anon, authenticated;
-- Preserve actual column types (including a possible status enum) in the backup.
CREATE TABLE IF NOT EXISTS ops_private.organic_posts_backup_20261112_000000 AS
  SELECT id AS post_id, campaign_id AS prior_campaign_id, status AS prior_status,
    false AS created_campaign, false AS applied FROM public.organic_posts WITH NO DATA;
CREATE UNIQUE INDEX IF NOT EXISTS organic_posts_backup_20261112_000000_post_idx
  ON ops_private.organic_posts_backup_20261112_000000 (post_id);
REVOKE ALL ON ops_private.organic_posts_backup_20261112_000000 FROM PUBLIC, anon, authenticated;
CREATE TEMP TABLE recovery_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO recovery_ids VALUES
 ('259ffa4c-8c2a-445d-8597-a17b6eb35b95'),
 ('8d78e331-c463-40a5-9696-388b551f7f51'),
 ('3e025ae5-c432-4367-b5d0-5f809be03589');
-- Explicit older opt-in only, after reviewing each candidate:
-- INSERT INTO recovery_ids VALUES ('da48433a-bb73-4ae6-9c1f-c3ce5679ca2f'),
-- ('918e9a34-bcf3-406a-b730-9f49dacc38fa'), ('15cbc324-1883-4a12-94f4-52877a3af116');
-- Lock both tables to exclude concurrent application approval during repair/backup.
LOCK TABLE public.organic_posts, public.live_campaigns IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT op.*, o.site_host, o.meta_pixel_id, o.business_email AS owner_email
    FROM public.organic_posts op JOIN recovery_ids r ON r.id=op.id
    JOIN public.offers o ON o.id=op.offer_id
  LOOP
    IF EXISTS (SELECT 1 FROM ops_private.organic_posts_backup_20261112_000000 b WHERE b.post_id=p.id AND b.applied) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM ops_private.organic_posts_backup_20261112_000000 b WHERE b.post_id=p.id AND NOT b.applied AND (b.prior_status IS DISTINCT FROM p.status OR b.prior_campaign_id IS DISTINCT FROM p.campaign_id)) THEN RAISE EXCEPTION 'State changed after prior undo; use a newly reviewed backup: %', p.id; END IF;
    IF p.status IS DISTINCT FROM 'approved' OR p.business_email IS DISTINCT FROM p.owner_email THEN RAISE EXCEPTION 'Post context/state mismatch: %', p.id; END IF;
    -- Match JavaScript String.length (UTF-16 code units), including emoji.
    IF (SELECT coalesce(sum(CASE WHEN ascii(substr(coalesce(p.caption,''),i,1))>65535 THEN 2 ELSE 1 END),0) FROM generate_series(1,length(coalesce(p.caption,''))) AS chars(i)) > 500 THEN RAISE EXCEPTION 'Caption too long: %', p.id; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.affiliate_requests ar WHERE ar.offer_id=p.offer_id AND ar.affiliate_email=p.affiliate_email AND lower(ar.status) IN ('approved','active','accepted')) THEN RAISE EXCEPTION 'Affiliate not approved: %', p.id; END IF;
    IF coalesce(p.site_host,'')='' AND coalesce(p.meta_pixel_id::text,'')=''
      AND NOT EXISTS (SELECT 1 FROM public.business_onboarding_progress bp WHERE bp.tracking_connected=true AND (bp.offer_id=p.offer_id OR (bp.offer_id IS NULL AND bp.business_email=p.business_email)))
      AND NOT EXISTS (SELECT 1 FROM public.campaign_tracking_events e WHERE e.offer_id=p.offer_id AND e.event_type='test_pixel')
    THEN RAISE EXCEPTION 'Tracking not ready: %', p.id; END IF;
    IF EXISTS (SELECT 1 FROM public.live_campaigns lc WHERE lc.id=p.id AND (lc.type IS DISTINCT FROM 'organic' OR lc.offer_id IS DISTINCT FROM p.offer_id OR lc.business_email IS DISTINCT FROM p.business_email OR lc.affiliate_email IS DISTINCT FROM p.affiliate_email)) THEN RAISE EXCEPTION 'Stable ID conflict: %', p.id; END IF;
    IF EXISTS (SELECT 1 FROM public.live_campaigns lc WHERE lc.offer_id=p.offer_id AND lc.affiliate_email=p.affiliate_email AND lc.business_email=p.business_email AND lc.type='organic' AND lc.id<>p.id) THEN RAISE EXCEPTION 'Existing pair requires mapping review: %', p.id; END IF;
    INSERT INTO ops_private.organic_posts_backup_20261112_000000 (post_id,prior_campaign_id,prior_status,created_campaign,applied)
      SELECT p.id,p.campaign_id,p.status,NOT EXISTS(SELECT 1 FROM public.live_campaigns lc WHERE lc.id=p.id),false
      ON CONFLICT (post_id) DO NOTHING;
    INSERT INTO public.live_campaigns (id,type,offer_id,business_email,affiliate_email,media_url,caption,platform,created_from,status)
      VALUES (p.id,'organic',p.offer_id,p.business_email,p.affiliate_email,coalesce(nullif(p.video_url,''),nullif(p.image_url,'')),nullif(p.caption,''),nullif(p.platform,''),'post-ideas','live')
      ON CONFLICT (id) DO NOTHING;
    UPDATE public.organic_posts SET campaign_id=p.id,status='approved' WHERE id=p.id;
    UPDATE ops_private.organic_posts_backup_20261112_000000 SET applied=true WHERE post_id=p.id;
  END LOOP;
  IF (SELECT count(*) FROM recovery_ids) <> (SELECT count(*) FROM public.organic_posts op JOIN recovery_ids r ON r.id=op.id JOIN public.offers o ON o.id=op.offer_id) THEN RAISE EXCEPTION 'Missing post/offer'; END IF;
END $$;
-- Canonical tracking URL: https://www.nettmark.com/go/<post_id>; no stored link needed.
SELECT post_id, 'https://www.nettmark.com/go/' || post_id::text AS tracking_link FROM ops_private.organic_posts_backup_20261112_000000 WHERE applied;
COMMIT;
