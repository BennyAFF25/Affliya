-- Prepared offline. Apply before application rollout; no automatic money movement.
BEGIN;
ALTER TABLE public.creator_partners
 ADD COLUMN IF NOT EXISTS program text NOT NULL DEFAULT 'creator',
 ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS application_id uuid UNIQUE,
 ADD COLUMN IF NOT EXISTS approved_at timestamptz,
 ADD COLUMN IF NOT EXISTS approved_by_email text,
 ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
 ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE public.creator_partners DROP CONSTRAINT IF EXISTS creator_partners_program_check;
ALTER TABLE public.creator_partners ADD CONSTRAINT creator_partners_program_check CHECK (program IN ('creator','growth_partner'));
ALTER TABLE public.creator_partners DROP CONSTRAINT IF EXISTS creator_partners_status_check;
ALTER TABLE public.creator_partners ADD CONSTRAINT creator_partners_status_check CHECK (status IN ('invited','active','paused','terminated','suspended'));
CREATE TABLE IF NOT EXISTS public.growth_partner_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL,
 email text NOT NULL CHECK (email=lower(email)), category text NOT NULL CHECK (category IN ('creator','educator','media_buyer','agency','consultant','accountant_or_advisor','other')),
 profile_url text NOT NULL, audience_estimate text NOT NULL CHECK (audience_estimate IN ('<1k','1k-10k','10k-50k','50k-250k','250k+')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 rejection_reason text, reviewed_at timestamptz, reviewed_by_email text,
 creator_partner_id uuid REFERENCES public.creator_partners(id), meta_event_id text UNIQUE NOT NULL,
 meta_capi_status text NOT NULL DEFAULT 'pending', attribution jsonb NOT NULL DEFAULT '{}',
 ip_hash text, user_agent text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS growth_partner_applications_pending_email_key ON public.growth_partner_applications(lower(email)) WHERE status='pending';
ALTER TABLE public.creator_partners DROP CONSTRAINT IF EXISTS creator_partners_application_id_fkey;
ALTER TABLE public.creator_partners ADD CONSTRAINT creator_partners_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.growth_partner_applications(id);
ALTER TABLE public.creator_referral_signup_intents ADD COLUMN IF NOT EXISTS captured_at timestamptz;
ALTER TABLE public.business_creator_attributions
 ADD COLUMN IF NOT EXISTS stripe_customer_id text,
 ADD COLUMN IF NOT EXISTS first_trial_started_at timestamptz,
 ADD COLUMN IF NOT EXISTS first_paid_at timestamptz,
 ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
CREATE TABLE IF NOT EXISTS public.creator_partner_payouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_partner_id uuid NOT NULL REFERENCES public.creator_partners(id),
 total_amount integer NOT NULL CHECK (total_amount>0), currency text NOT NULL,
 method text NOT NULL DEFAULT 'manual_bank_transfer', reference text NOT NULL, notes text,
 status text NOT NULL DEFAULT 'recorded' CHECK (status='recorded'), recorded_by_email text NOT NULL,
 paid_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_commission_ledger DROP CONSTRAINT IF EXISTS creator_commission_ledger_status_check;
UPDATE public.creator_commission_ledger SET status='approved' WHERE status='payable';
ALTER TABLE public.creator_commission_ledger ADD CONSTRAINT creator_commission_ledger_status_check CHECK (status IN ('pending','approved','paid','reversed','rejected'));
ALTER TABLE public.creator_commission_ledger
 ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'commission' CHECK (entry_type IN ('commission','clawback')),
 ADD COLUMN IF NOT EXISTS revenue_type text NOT NULL DEFAULT 'subscription',
 ADD COLUMN IF NOT EXISTS amount_paid integer,
 ADD COLUMN IF NOT EXISTS tax_amount integer,
 ADD COLUMN IF NOT EXISTS refunded_amount integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS original_ledger_id uuid REFERENCES public.creator_commission_ledger(id),
 ADD COLUMN IF NOT EXISTS stripe_refund_id text,
 ADD COLUMN IF NOT EXISTS approvable_at timestamptz,
 ADD COLUMN IF NOT EXISTS approved_at timestamptz,
 ADD COLUMN IF NOT EXISTS approved_by_email text,
 ADD COLUMN IF NOT EXISTS paid_at timestamptz,
 ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.creator_partner_payouts(id);
ALTER TABLE public.creator_commission_ledger DROP CONSTRAINT IF EXISTS creator_commission_ledger_amount_check;
ALTER TABLE public.creator_commission_ledger ADD CONSTRAINT creator_commission_ledger_amount_check CHECK (gross_eligible_subscription_amount>=0 AND ((entry_type='commission' AND commission_amount>=0) OR (entry_type='clawback' AND commission_amount<=0)));
DROP INDEX IF EXISTS public.creator_commission_ledger_invoice_key;
CREATE UNIQUE INDEX IF NOT EXISTS creator_commission_ledger_invoice_key ON public.creator_commission_ledger(stripe_invoice_id) WHERE entry_type='commission';
CREATE UNIQUE INDEX IF NOT EXISTS creator_commission_ledger_refund_key ON public.creator_commission_ledger(stripe_refund_id) WHERE entry_type='clawback';
CREATE TABLE IF NOT EXISTS public.creator_referral_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_partner_id uuid NOT NULL REFERENCES public.creator_partners(id),
 business_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
 event_type text NOT NULL CHECK (event_type IN ('click','signup_intent','attributed','attribution_rejected','trial_started','converted','renewal_paid','payment_failed','subscription_cancelled','refund','dispute','commission_created','commission_skipped','commission_reversed','clawback_created','commission_approved','payout_recorded','partner_approved','partner_suspended','partner_reactivated')),
 source_key text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS creator_referral_events_source_key ON public.creator_referral_events(event_type,source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS creator_referral_events_partner_created_idx ON public.creator_referral_events(creator_partner_id,created_at DESC);
ALTER TABLE public.growth_partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_partner_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_referral_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_partner_applications, public.creator_partner_payouts, public.creator_referral_events FROM anon, authenticated;
GRANT ALL ON public.growth_partner_applications, public.creator_partner_payouts, public.creator_referral_events TO service_role;
DROP TRIGGER IF EXISTS set_growth_partner_applications_updated_at ON public.growth_partner_applications;
CREATE TRIGGER set_growth_partner_applications_updated_at BEFORE UPDATE ON public.growth_partner_applications FOR EACH ROW EXECUTE FUNCTION public.set_creator_referral_updated_at();
CREATE OR REPLACE FUNCTION public.attach_creator_referral_attribution(
  p_business_id uuid,
  p_business_email text,
  p_attribution_source text DEFAULT 'business_profile_insert'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.creator_referral_signup_intents%ROWTYPE;
  v_attribution_id uuid;
  v_is_grandfathered boolean;
  v_reason text;
  v_partner public.creator_partners%ROWTYPE;
  v_business public.business_profiles%ROWTYPE;
BEGIN
  IF p_business_id IS NULL OR p_business_email IS NULL OR btrim(p_business_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_intent
  FROM public.creator_referral_signup_intents i
  WHERE lower(i.business_email) = lower(p_business_email)
    AND i.consumed_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_partner FROM public.creator_partners WHERE id=v_intent.creator_partner_id;
  SELECT * INTO v_business FROM public.business_profiles WHERE id=p_business_id;
  IF EXISTS (SELECT 1 FROM public.business_creator_attributions WHERE business_id=p_business_id OR lower(business_email)=lower(p_business_email)) THEN
    v_reason := 'business_already_attributed';
  ELSIF v_partner.status <> 'active' THEN v_reason := 'partner_not_active';
  ELSIF lower(v_partner.partner_email)=lower(p_business_email) OR v_partner.user_id=v_intent.user_id OR v_partner.user_id=p_business_id OR EXISTS (
    SELECT 1 FROM public.growth_partner_applications a WHERE a.id=v_partner.application_id AND a.email=lower(p_business_email)
  ) THEN v_reason := 'self_referral_rejected';
  ELSIF v_business.created_at < coalesce(v_intent.captured_at,v_intent.created_at) THEN v_reason := 'pre_existing_business';
  ELSIF EXISTS (SELECT 1 FROM public.business_entitlements be WHERE (be.business_id=p_business_id OR lower(be.business_email)=lower(p_business_email)) AND (be.is_grandfathered OR be.growth_trial_used OR be.stripe_subscription_id IS NOT NULL)) THEN v_reason := 'existing_subscription_or_trial';
  END IF;
  IF v_reason IS NOT NULL THEN
    INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key,metadata)
    VALUES(v_intent.creator_partner_id,p_business_id,'attribution_rejected',v_intent.id::text,jsonb_build_object('reason',v_reason)) ON CONFLICT DO NOTHING;
    RETURN NULL;
  END IF;
  INSERT INTO public.business_creator_attributions (
    business_id,
    business_email,
    creator_partner_id,
    referral_code,
    attributed_at,
    attribution_source,
    landing_session_id,
    metadata
  ) VALUES (
    p_business_id,
    p_business_email,
    v_intent.creator_partner_id,
    v_intent.referral_code,
    now(),
    COALESCE(p_attribution_source, v_intent.attribution_source),
    v_intent.landing_session_id,
    jsonb_build_object(
      'signupIntentId', v_intent.id,
      'landingPath', v_intent.landing_path,
      'landingReferrer', v_intent.landing_referrer,
      'userId', v_intent.user_id
    )
  )
  ON CONFLICT (business_id) DO NOTHING
  RETURNING id INTO v_attribution_id;

  IF v_attribution_id IS NOT NULL THEN
    INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key)
    VALUES(v_intent.creator_partner_id,p_business_id,'attributed',p_business_id::text) ON CONFLICT DO NOTHING;
    UPDATE public.creator_referral_signup_intents
    SET consumed_at = now(), updated_at = now()
    WHERE id = v_intent.id;
  ELSE
    SELECT id INTO v_attribution_id
    FROM public.business_creator_attributions
    WHERE business_id = p_business_id;
  END IF;

  RETURN v_attribution_id;
END;
$$;

-- Serialize invoice creation per attribution, including resubscriptions.
CREATE OR REPLACE FUNCTION public.create_creator_subscription_commission(p_attribution_id uuid,p_invoice_id text,p_subscription_id text,p_base integer,p_amount_paid integer,p_tax integer,p_currency text,p_paid_at timestamptz,p_hold_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.business_creator_attributions%ROWTYPE; p public.creator_partners%ROWTYPE; n integer; l uuid; reason text; amount integer;
BEGIN
 SELECT * INTO a FROM public.business_creator_attributions WHERE id=p_attribution_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attribution missing'; END IF;
 SELECT * INTO p FROM public.creator_partners WHERE id=a.creator_partner_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.creator_commission_ledger WHERE stripe_invoice_id=p_invoice_id AND entry_type='commission') THEN RETURN jsonb_build_object('created',false,'reason','duplicate_invoice'); END IF;
 SELECT count(*)+1 INTO n FROM public.creator_commission_ledger WHERE business_creator_attribution_id=a.id AND entry_type='commission' AND status IN ('pending','approved','paid');
 IF p.status<>'active' THEN reason:='partner_not_active';
 ELSIF n>p.commission_duration_months THEN reason:='commission_duration_complete';
 ELSIF p_base<=0 OR p_amount_paid<=0 OR p_base>p_amount_paid OR p_hold_days<0 THEN reason:='invalid_amount'; END IF;
 IF reason IS NOT NULL THEN
 INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key,metadata) VALUES(p.id,a.business_id,'commission_skipped',p_invoice_id,jsonb_build_object('reason',reason)) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('created',false,'reason',reason);
 END IF;
 amount:=round(p_base*p.commission_percentage/100);
 INSERT INTO public.creator_commission_ledger(creator_partner_id,business_id,business_creator_attribution_id,stripe_invoice_id,stripe_subscription_id,gross_eligible_subscription_amount,commission_percentage,commission_amount,currency,commission_month_number,status,eligibility_date,approvable_at,amount_paid,tax_amount,metadata)
 VALUES(p.id,a.business_id,a.id,p_invoice_id,p_subscription_id,p_base,p.commission_percentage,amount,lower(p_currency),n,'pending',p_paid_at,p_paid_at+make_interval(days=>p_hold_days),p_amount_paid,p_tax,jsonb_build_object('original_commission_amount',amount)) RETURNING id INTO l;
 UPDATE public.business_creator_attributions SET first_paid_at=coalesce(first_paid_at,p_paid_at),first_subscription_id=coalesce(first_subscription_id,p_subscription_id) WHERE id=a.id;
 INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key,metadata) VALUES(p.id,a.business_id,'commission_created',p_invoice_id,jsonb_build_object('ledger_id',l,'month',n)) ON CONFLICT DO NOTHING;
 INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key) VALUES(p.id,a.business_id,CASE WHEN a.first_paid_at IS NULL THEN 'converted' ELSE 'renewal_paid' END,p_invoice_id) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('created',true,'ledgerId',l,'monthNumber',n);
END $$;

-- The original commission row is the cumulative-refund watermark. Lock it before payout/refund mutation.
CREATE OR REPLACE FUNCTION public.refund_creator_subscription_commission(p_invoice_id text,p_refund_key text,p_cumulative_amount integer,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.creator_commission_ledger%ROWTYPE; target integer; old_target integer; cumulative integer; delta integer; original integer; clawback uuid;
BEGIN
 SELECT * INTO l FROM public.creator_commission_ledger WHERE stripe_invoice_id=p_invoice_id AND entry_type='commission' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('reversed',false); END IF;
 IF l.amount_paid IS NULL OR l.amount_paid<=0 THEN RAISE EXCEPTION 'Legacy amount requires reconciliation'; END IF;
 cumulative:=least(l.amount_paid,greatest(0,coalesce(p_cumulative_amount,l.amount_paid)));
 IF cumulative<=l.refunded_amount THEN RETURN jsonb_build_object('reversed',false,'reason','duplicate_refund'); END IF;
 original:=coalesce((l.metadata->>'original_commission_amount')::integer,round(l.gross_eligible_subscription_amount*l.commission_percentage/100));
 target:=round(original::numeric*(l.amount_paid-cumulative)/l.amount_paid);
 old_target:=round(original::numeric*(l.amount_paid-l.refunded_amount)/l.amount_paid);
 delta:=old_target-target;
 IF l.status='paid' AND delta>0 THEN
 INSERT INTO public.creator_commission_ledger(creator_partner_id,business_id,business_creator_attribution_id,stripe_invoice_id,stripe_subscription_id,gross_eligible_subscription_amount,commission_percentage,commission_amount,currency,commission_month_number,status,eligibility_date,entry_type,original_ledger_id,stripe_refund_id,metadata)
 VALUES(l.creator_partner_id,l.business_id,l.business_creator_attribution_id,l.stripe_invoice_id,l.stripe_subscription_id,0,l.commission_percentage,-delta,l.currency,l.commission_month_number,'pending',now(),'clawback',l.id,p_refund_key,jsonb_build_object('reason',p_reason))
 ON CONFLICT DO NOTHING RETURNING id INTO clawback;
 IF clawback IS NULL THEN RETURN jsonb_build_object('reversed',false,'reason','duplicate_refund'); END IF;
 INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key,metadata) VALUES(l.creator_partner_id,l.business_id,'clawback_created',p_refund_key,jsonb_build_object('ledger_id',clawback,'amount',-delta)) ON CONFLICT DO NOTHING;
 ELSIF l.status IN ('pending','approved') THEN
 UPDATE public.creator_commission_ledger SET commission_amount=target,status=CASE WHEN cumulative=l.amount_paid THEN 'reversed' ELSE status END,reversal_reason=p_reason,reversed_at=CASE WHEN cumulative=l.amount_paid THEN now() ELSE reversed_at END WHERE id=l.id;
 END IF;
 UPDATE public.creator_commission_ledger SET refunded_amount=cumulative WHERE id=l.id;
 INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key,metadata) VALUES(l.creator_partner_id,l.business_id,CASE WHEN p_reason LIKE '%disput%' THEN 'dispute' ELSE 'refund' END,p_refund_key,jsonb_build_object('before',old_target,'after',target,'refunded_amount',cumulative)) ON CONFLICT DO NOTHING;
 IF cumulative=l.amount_paid AND l.status IN ('pending','approved') THEN
 INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key) VALUES(l.creator_partner_id,l.business_id,'commission_reversed',p_refund_key) ON CONFLICT DO NOTHING;
 END IF;
 RETURN jsonb_build_object('reversed',true);
END $$;

CREATE OR REPLACE FUNCTION public.review_creator_commission(p_ledger_id uuid,p_approve boolean,p_reason text,p_reviewed_by text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.creator_commission_ledger%ROWTYPE;
BEGIN
 SELECT * INTO l FROM public.creator_commission_ledger WHERE id=p_ledger_id FOR UPDATE;
 IF NOT FOUND OR l.status<>'pending' OR l.entry_type<>'commission' THEN RAISE EXCEPTION 'Only pending commissions can be reviewed'; END IF;
 IF p_approve AND (l.approvable_at IS NULL OR l.approvable_at>now()) THEN RAISE EXCEPTION 'Refund hold has not elapsed'; END IF;
 UPDATE public.creator_commission_ledger SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,approved_at=CASE WHEN p_approve THEN now() END,approved_by_email=p_reviewed_by,reversal_reason=CASE WHEN NOT p_approve THEN p_reason END WHERE id=l.id;
 IF p_approve THEN INSERT INTO public.creator_referral_events(creator_partner_id,business_id,event_type,source_key,metadata) VALUES(l.creator_partner_id,l.business_id,'commission_approved',l.id::text,jsonb_build_object('reviewed_by',p_reviewed_by)) ON CONFLICT DO NOTHING; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_creator_partner_payout(partner_id uuid,ledger_ids uuid[],method text,reference text,notes text,recorded_by text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.creator_commission_ledger%ROWTYPE; total integer:=0; curr text; n integer:=0; payout uuid;
BEGIN
 IF cardinality(ledger_ids) IS NULL OR cardinality(ledger_ids)=0 OR nullif(btrim(reference),'') IS NULL THEN RAISE EXCEPTION 'Ledger rows and reference required'; END IF;
 -- Same deterministic lock order as all ledger mutations.
 FOR l IN SELECT * FROM public.creator_commission_ledger WHERE id=ANY(ledger_ids) ORDER BY id FOR UPDATE LOOP
 IF l.creator_partner_id<>partner_id OR NOT (l.status='approved' AND l.entry_type='commission' OR l.status='pending' AND l.entry_type='clawback') THEN RAISE EXCEPTION 'Invalid payout selection'; END IF;
 IF curr IS NOT NULL AND curr<>l.currency THEN RAISE EXCEPTION 'Mixed currencies'; END IF;
 curr:=l.currency; total:=total+l.commission_amount; n:=n+1;
 END LOOP;
 IF n<>(SELECT count(DISTINCT x) FROM unnest(ledger_ids) x) OR total<=0 THEN RAISE EXCEPTION 'Invalid payout total or missing rows'; END IF;
 INSERT INTO public.creator_partner_payouts(creator_partner_id,total_amount,currency,method,reference,notes,recorded_by_email) VALUES(partner_id,total,curr,coalesce(nullif(method,''),'manual_bank_transfer'),reference,notes,recorded_by) RETURNING id INTO payout;
 UPDATE public.creator_commission_ledger SET status='paid',paid_at=now(),payout_id=payout WHERE id=ANY(ledger_ids);
 INSERT INTO public.creator_referral_events(creator_partner_id,event_type,source_key,metadata) VALUES(partner_id,'payout_recorded',payout::text,jsonb_build_object('total',total,'currency',curr,'recorded_by',recorded_by));
 RETURN payout;
END $$;

-- Approval is atomic after the retryable external Auth identity lookup/create.
CREATE OR REPLACE FUNCTION public.approve_growth_partner_application(p_application_id uuid,p_user_id uuid,p_code text,p_origin text,p_reviewed_by text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.growth_partner_applications%ROWTYPE; partner uuid;
BEGIN
 SELECT * INTO a FROM public.growth_partner_applications WHERE id=p_application_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application missing'; END IF;
 IF a.status='approved' THEN RETURN a.creator_partner_id; END IF;
 IF a.status<>'pending' THEN RAISE EXCEPTION 'Application is not pending'; END IF;
 INSERT INTO public.creator_partners(display_name,partner_email,referral_code,referral_url,status,program,user_id,application_id,approved_at,approved_by_email)
 VALUES(a.full_name,a.email,p_code,p_origin||'/r/'||p_code,'active','growth_partner',p_user_id,a.id,now(),p_reviewed_by) RETURNING id INTO partner;
 UPDATE public.growth_partner_applications SET status='approved',creator_partner_id=partner,reviewed_at=now(),reviewed_by_email=p_reviewed_by WHERE id=a.id;
 INSERT INTO public.creator_referral_events(creator_partner_id,event_type,source_key,metadata) VALUES(partner,'partner_approved',a.id::text,jsonb_build_object('reviewed_by',p_reviewed_by));
 RETURN partner;
END $$;

-- Email lookup avoids an unbounded Auth admin listUsers scan; service-role only.
CREATE OR REPLACE FUNCTION public.growth_partner_auth_user_id(p_email text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT id FROM auth.users WHERE lower(email)=lower(p_email) LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.attach_creator_referral_attribution(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attach_creator_referral_attribution(uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.create_creator_subscription_commission(uuid,text,text,integer,integer,integer,text,timestamptz,integer),public.refund_creator_subscription_commission(text,text,integer,text),public.review_creator_commission(uuid,boolean,text,text),public.record_creator_partner_payout(uuid,uuid[],text,text,text,text),public.approve_growth_partner_application(uuid,uuid,text,text,text),public.growth_partner_auth_user_id(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_creator_subscription_commission(uuid,text,text,integer,integer,integer,text,timestamptz,integer),public.refund_creator_subscription_commission(text,text,integer,text),public.review_creator_commission(uuid,boolean,text,text),public.record_creator_partner_payout(uuid,uuid[],text,text,text,text),public.approve_growth_partner_application(uuid,uuid,text,text,text),public.growth_partner_auth_user_id(text) TO service_role;
COMMIT;
