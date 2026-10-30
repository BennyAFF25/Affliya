BEGIN;
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_reason text NULL;

-- Service-role only. Reuse the same transactional queue as offer.created.
CREATE OR REPLACE FUNCTION public.delete_business_offer(p_offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  offer_row public.offers%ROWTYPE;
  ref record;
  has_dependents boolean := false;
  found_dependency boolean;
  brand_id uuid;
  reason text := 'delete_requested_has_dependents';
BEGIN
  SELECT * INTO offer_row FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF offer_row.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'archived', 'offer', to_jsonb(offer_row));
  END IF;
  -- Catalog discovery covers legacy proposals and money records even without FKs,
  -- including wallet_holds.launch_offer_id and allocated_for_offer_id.
  -- Exclude the event queue: every offer already has an offer.created event.
  FOR ref IN
    SELECT c.table_name, c.column_name, c.udt_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND t.table_type='BASE TABLE'
      AND c.column_name IN ('offer_id', 'launch_offer_id', 'allocated_for_offer_id')
      AND c.table_name <> 'affiliate_webhook_outbox'
    ORDER BY c.table_name, c.column_name
  LOOP
    -- Prevent a new dependent appearing between the check and a cascading delete.
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', ref.table_name);
    IF ref.table_name = 'affiliate_requests' THEN
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I=$1::%s AND (status IS NULL OR lower(status::text) NOT IN (''rejected'',''withdrawn'',''declined'')))', ref.table_name, ref.column_name, CASE WHEN ref.udt_name='uuid' THEN 'uuid' ELSE 'text' END)
        INTO found_dependency USING p_offer_id::text;
    ELSE
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I=$1::%s)', ref.table_name, ref.column_name, CASE WHEN ref.udt_name='uuid' THEN 'uuid' ELSE 'text' END)
        INTO found_dependency USING p_offer_id::text;
    END IF;
    has_dependents := has_dependents OR found_dependency;
  END LOOP;
  SELECT bp.id INTO brand_id FROM public.business_profiles bp
    WHERE lower(bp.business_email)=lower(offer_row.business_email) LIMIT 1;
  brand_id := coalesce(nullif(to_jsonb(offer_row)->>'business_id','')::uuid, brand_id);
  IF NOT has_dependents THEN
    BEGIN
      PERFORM private.queue_affiliate_webhook_event(
        'offer.deleted', brand_id, offer_row.business_email, p_offer_id, NULL,
        p_offer_id::text, jsonb_build_object('title', offer_row.title, 'business_id', brand_id,
          'business_email', offer_row.business_email), 'offer.deleted:' || p_offer_id::text);
      DELETE FROM public.offers WHERE id=p_offer_id;
      RETURN jsonb_build_object('action', 'deleted', 'id', p_offer_id);
    EXCEPTION WHEN foreign_key_violation THEN
      -- Subtransaction rolls back the delete event as well as the failed delete.
      has_dependents := true;
    END;
  END IF;
  UPDATE public.offers SET archived_at=now(), archived_reason=reason
    WHERE id=p_offer_id RETURNING * INTO offer_row;
  PERFORM private.queue_affiliate_webhook_event(
    'offer.archived', brand_id, offer_row.business_email, p_offer_id, NULL,
    p_offer_id::text, jsonb_build_object('reason', reason, 'title', offer_row.title),
    'offer.archived:' || p_offer_id::text);
  RETURN jsonb_build_object('action', 'archived', 'offer', to_jsonb(offer_row));
END;
$$;
REVOKE ALL ON FUNCTION public.delete_business_offer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_business_offer(uuid) TO service_role;
COMMIT;
