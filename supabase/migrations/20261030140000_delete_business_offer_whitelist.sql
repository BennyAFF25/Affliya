BEGIN;
DROP FUNCTION IF EXISTS public.delete_business_offer(uuid);
-- Service-role only. Reuse the same transactional queue as offer.created.
CREATE OR REPLACE FUNCTION public.delete_business_offer(p_offer_id uuid, p_dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  offer_row public.offers%ROWTYPE;
  ref record;
  has_dependents boolean := false;
  dependency_count bigint;
  reference_type text;
  dependents jsonb := '[]'::jsonb;
  brand_id uuid;
  reason text := 'delete_requested_has_dependents';
BEGIN
  IF p_dry_run THEN
    SELECT * INTO offer_row FROM public.offers WHERE id = p_offer_id;
  ELSE
    SELECT * INTO offer_row FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT p_dry_run AND offer_row.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'archived', 'offer', to_jsonb(offer_row));
  END IF;
  -- Explicit business-history whitelist. Preview takes no row/table write locks.
  FOR ref IN
    SELECT * FROM (VALUES
      ('affiliate_requests', 'offer_id'),
      ('live_ads', 'offer_id'),
      ('live_campaigns', 'offer_id'),
      ('organic_posts', 'offer_id'),
      ('ad_ideas', 'offer_id'),
      ('inbox_chat_messages', 'offer_id'),
      ('wallet_deductions', 'offer_id'),
      ('wallet_holds', 'launch_offer_id'),
      ('wallet_payouts', 'offer_id'),
      ('conversions', 'offer_id'),
      ('clicks', 'offer_id'),
      ('campaign_tracking_events', 'offer_id'),
      ('ad_spend_settlements', 'offer_id'),
      ('recurring_commission_instances', 'offer_id'),
      ('affiliate_launch_fund_allocations', 'allocated_for_offer_id'),
      ('affiliate_launch_fund_events', 'offer_id'),
      ('affiliate_launch_fund_transactions', 'offer_id'),
      ('business_activation_subsidies', 'offer_id'),
      ('billable_event_quarantine', 'offer_id'),
      ('money_flow_audit_log', 'offer_id')
    ) AS refs(table_name, column_name) ORDER BY table_name
  LOOP
    IF to_regclass(format('public.%I', ref.table_name)) IS NULL THEN CONTINUE; END IF;
    IF NOT p_dry_run THEN
      EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', ref.table_name);
    END IF;
    -- Preserve indexed comparisons for both legacy text and UUID references.
    SELECT CASE WHEN c.udt_name='uuid' THEN 'uuid' ELSE 'text' END INTO reference_type
      FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=ref.table_name AND c.column_name=ref.column_name;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I=$1::%s%s',
      ref.table_name, ref.column_name, reference_type,
      CASE WHEN ref.table_name = 'affiliate_requests'
        THEN ' AND (status IS NULL OR lower(status::text) NOT IN (''rejected'',''withdrawn'',''declined''))'
        ELSE '' END)
      INTO dependency_count USING p_offer_id::text;
    IF dependency_count > 0 THEN
      dependents := dependents || jsonb_build_array(jsonb_build_object('table', ref.table_name, 'count', dependency_count));
    END IF;
  END LOOP;
  has_dependents := jsonb_array_length(dependents) > 0;
  IF p_dry_run THEN
    RETURN jsonb_build_object('willArchive', has_dependents OR offer_row.archived_at IS NOT NULL, 'dependents', dependents);
  END IF;
  SELECT bp.id INTO brand_id FROM public.business_profiles bp
    WHERE lower(bp.business_email)=lower(offer_row.business_email) LIMIT 1;
  brand_id := coalesce(nullif(to_jsonb(offer_row)->>'business_id','')::uuid, brand_id);
  IF NOT has_dependents THEN
    BEGIN
      -- Disposable references do not block deletion. Keep cleanup in this
      -- subtransaction so an unexpected FK failure restores these rows too.
      IF to_regclass('public.product_events') IS NOT NULL THEN
        LOCK TABLE public.product_events IN SHARE ROW EXCLUSIVE MODE;
        UPDATE public.product_events SET offer_id=NULL WHERE offer_id=p_offer_id;
      END IF;
      IF to_regclass('public.business_onboarding_progress') IS NOT NULL THEN
        LOCK TABLE public.business_onboarding_progress IN SHARE ROW EXCLUSIVE MODE;
        DELETE FROM public.business_onboarding_progress WHERE offer_id=p_offer_id;
      END IF;
      IF to_regclass('public.business_creatives') IS NOT NULL THEN
        LOCK TABLE public.business_creatives IN SHARE ROW EXCLUSIVE MODE;
        UPDATE public.business_creatives SET offer_id=NULL WHERE offer_id=p_offer_id;
      END IF;
      PERFORM private.queue_affiliate_webhook_event(
        'offer.deleted', brand_id, offer_row.business_email, p_offer_id, NULL,
        p_offer_id::text, jsonb_build_object('offer_id', p_offer_id, 'title', offer_row.title, 'business_id', brand_id,
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
    p_offer_id::text, jsonb_build_object('offer_id', p_offer_id, 'business_id', brand_id,
      'business_email', offer_row.business_email, 'title', offer_row.title,
      'reason', reason, 'blocking_dependents', dependents),
    'offer.archived:' || p_offer_id::text);
  RETURN jsonb_build_object('action', 'archived', 'offer', to_jsonb(offer_row));
END;
$$;
REVOKE ALL ON FUNCTION public.delete_business_offer(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_business_offer(uuid, boolean) TO service_role;
create or replace function private.capture_affiliate_webhook_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  j_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  v_business_id uuid;
  v_business_email text;
  v_affiliate_email text;
  v_offer_id uuid;
  v_changed jsonb := '[]'::jsonb;
  v_old_plan text;
  v_new_plan text;
begin
  if tg_table_name = 'business_profiles' then
    v_business_id := nullif(j_new->>'id', '')::uuid;
    v_business_email := j_new->>'business_email';

    if tg_op = 'INSERT' then
      perform private.queue_affiliate_webhook_event(
        'brand.signed_up', v_business_id, v_business_email, null, null,
        j_new->>'id',
        jsonb_build_object('signup_source', null, 'category', null),
        'brand.signed_up:' || coalesce(j_new->>'id', v_business_email)
      );
    elsif tg_op = 'UPDATE' then
      select coalesce(jsonb_agg(key order by key), '[]'::jsonb)
      into v_changed
      from jsonb_object_keys(j_new) as changed(key)
      where key = any(array['business_name','country','avatar_url'])
        and j_old->key is distinct from j_new->key;

      if jsonb_array_length(v_changed) > 0 then
        perform private.queue_affiliate_webhook_event(
          'brand.profile_updated', v_business_id, v_business_email, null, null,
          j_new->>'id',
          jsonb_build_object('changed_fields', v_changed),
          null
        );
      end if;
    end if;

  elsif tg_table_name = 'offers' then
    if tg_op = 'UPDATE'
      and (j_new - ARRAY['archived_at','archived_reason','updated_at'])
        = (j_old - ARRAY['archived_at','archived_reason','updated_at'])
      and (j_new->'archived_at' is distinct from j_old->'archived_at'
        or j_new->'archived_reason' is distinct from j_old->'archived_reason') then
      return new;
    end if;
    v_business_email := case when tg_op = 'DELETE' then j_old->>'business_email' else j_new->>'business_email' end;
    v_offer_id := nullif(case when tg_op = 'DELETE' then j_old->>'id' else j_new->>'id' end, '')::uuid;
    select bp.id into v_business_id
      from public.business_profiles bp
      where lower(bp.business_email) = lower(v_business_email)
      limit 1;

    if tg_op = 'INSERT' then
      perform private.queue_affiliate_webhook_event(
        'offer.created', v_business_id, v_business_email, v_offer_id, null,
        j_new->>'id', '{}'::jsonb, 'offer.created:' || (j_new->>'id')
      );
    elsif tg_op = 'UPDATE' then
      select coalesce(jsonb_agg(key order by key), '[]'::jsonb)
      into v_changed
      from jsonb_object_keys(j_new) as changed(key)
      where key <> 'created_at'
        and j_old->key is distinct from j_new->key;

      if jsonb_array_length(v_changed) > 0 then
        perform private.queue_affiliate_webhook_event(
          'offer.updated', v_business_id, v_business_email, v_offer_id, null,
          j_new->>'id', jsonb_build_object('changed_fields', v_changed), null
        );
      end if;
    end if;

  elsif tg_table_name = 'meta_connections' then
    v_business_email := case when tg_op = 'DELETE' then j_old->>'business_email' else j_new->>'business_email' end;
    select bp.id into v_business_id
      from public.business_profiles bp
      where lower(bp.business_email) = lower(v_business_email)
      limit 1;

    if tg_op = 'DELETE' then
      perform private.queue_affiliate_webhook_event(
        'meta.disconnected', v_business_id, v_business_email, null, null,
        j_old->>'id', '{}'::jsonb,
        'meta.disconnected:' || v_business_email || ':' || txid_current()::text
      );
    elsif tg_op = 'INSERT'
       or (tg_op = 'UPDATE' and (
         j_old->>'access_token' is distinct from j_new->>'access_token'
         or j_old->>'ad_account_id' is distinct from j_new->>'ad_account_id'
         or j_old->>'page_id' is distinct from j_new->>'page_id'
       )) then
      perform private.queue_affiliate_webhook_event(
        'meta.connected', v_business_id, v_business_email, null, null,
        j_new->>'id',
        jsonb_build_object(
          'ad_account_id', j_new->>'ad_account_id',
          'page_id', j_new->>'page_id',
          'page_name', j_new->>'page_name'
        ),
        'meta.connected:' || v_business_email || ':' || txid_current()::text
      );
    end if;

  elsif tg_table_name = 'business_entitlements' and tg_op = 'UPDATE' then
    v_business_id := nullif(j_new->>'business_id', '')::uuid;
    v_business_email := j_new->>'business_email';
    v_old_plan := case when coalesce(j_old->>'billing_status','') in ('subscription_active','subscription_trialing','subscription_past_due','subscription_unpaid','subscription_incomplete') then 'growth' else 'free' end;
    v_new_plan := case when coalesce(j_new->>'billing_status','') in ('subscription_active','subscription_trialing','subscription_past_due','subscription_unpaid','subscription_incomplete') then 'growth' else 'free' end;

    if v_old_plan is distinct from v_new_plan then
      perform private.queue_affiliate_webhook_event(
        case when v_new_plan = 'growth' then 'plan.upgraded' else 'plan.downgraded' end,
        v_business_id, v_business_email, null, null,
        j_new->>'id',
        jsonb_build_object('from', v_old_plan, 'to', v_new_plan),
        null
      );
    end if;

  elsif tg_table_name = 'ad_ideas' and tg_op = 'UPDATE' then
    v_business_email := j_new->>'business_email';
    v_affiliate_email := j_new->>'affiliate_email';
    v_offer_id := nullif(j_new->>'offer_id', '')::uuid;
    select bp.id into v_business_id
      from public.business_profiles bp
      where lower(bp.business_email) = lower(v_business_email)
      limit 1;

    if lower(coalesce(v_affiliate_email, '')) = 'jamesmarkets@gmail.com'
      and (j_old->>'business_viewed_at') is null
      and (j_new->>'business_viewed_at') is not null then
      perform private.queue_affiliate_webhook_event(
        'proposal.viewed', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
        j_new->>'id',
        jsonb_build_object(
          'proposal_id', j_new->>'id',
          'offer_id', j_new->>'offer_id',
          'viewed_at', j_new->>'business_viewed_at'
        ),
        'proposal.viewed:' || (j_new->>'id')
      );
    end if;

    if lower(coalesce(v_affiliate_email, '')) = 'jamesmarkets@gmail.com'
      and (j_old->>'status') is distinct from (j_new->>'status') then
      if lower(coalesce(j_new->>'status','')) = 'approved' then
        perform private.queue_affiliate_webhook_event(
          'proposal.approved', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
          j_new->>'id',
          jsonb_build_object('proposal_id', j_new->>'id', 'offer_id', j_new->>'offer_id', 'note', null),
          null
        );
      elsif lower(coalesce(j_new->>'status','')) = 'rejected' then
        perform private.queue_affiliate_webhook_event(
          'proposal.rejected', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
          j_new->>'id',
          jsonb_build_object('proposal_id', j_new->>'id', 'offer_id', j_new->>'offer_id', 'reason', j_new->>'rejection_reason'),
          null
        );
      elsif lower(coalesce(j_new->>'status','')) = 'changes_requested' then
        perform private.queue_affiliate_webhook_event(
          'proposal.changes_requested', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
          j_new->>'id',
          jsonb_build_object('proposal_id', j_new->>'id', 'comment', j_new->>'rejection_reason'),
          null
        );
      end if;
    end if;

  elsif tg_table_name = 'live_ads' then
    v_business_email := case when tg_op = 'DELETE' then j_old->>'business_email' else j_new->>'business_email' end;
    v_affiliate_email := case when tg_op = 'DELETE' then j_old->>'affiliate_email' else j_new->>'affiliate_email' end;
    v_business_id := nullif(case when tg_op = 'DELETE' then j_old->>'business_id' else j_new->>'business_id' end, '')::uuid;
    v_offer_id := nullif(case when tg_op = 'DELETE' then j_old->>'offer_id' else j_new->>'offer_id' end, '')::uuid;

    if tg_op = 'INSERT' then
      perform private.queue_affiliate_webhook_event(
        'campaign.launched', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
        j_new->>'id',
        jsonb_build_object(
          'campaign_id', j_new->>'id',
          'proposal_id', j_new->>'ad_idea_id'
        ),
        'campaign.launched:live_ads:' || (j_new->>'id')
      );
    elsif tg_op = 'UPDATE'
      and lower(coalesce(j_old->>'status','')) <> 'paused'
      and lower(coalesce(j_new->>'status','')) = 'paused'
      and (j_new->>'terminated_by_business_at') is not null then
      perform private.queue_affiliate_webhook_event(
        'campaign.paused', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
        j_new->>'id',
        jsonb_build_object(
          'campaign_id', j_new->>'id',
          'proposal_id', case when tg_table_name = 'live_ads' then j_new->>'ad_idea_id' else null end
        ),
        null
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.capture_affiliate_webhook_event()
  from public, anon, authenticated;

COMMIT;
