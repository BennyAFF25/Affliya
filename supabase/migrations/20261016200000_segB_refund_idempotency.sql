BEGIN;
CREATE TABLE public.wallet_refund_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_email text NOT NULL,
  source_topup_id uuid NOT NULL REFERENCES public.wallet_topups(id),
  request_key text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0 AND amount * 100 = trunc(amount * 100)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  stripe_refund_id text UNIQUE,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX segB_refund_request ON public.wallet_refund_attempts(affiliate_email,request_key)
  WHERE status IN ('pending','succeeded');
CREATE UNIQUE INDEX segB_refund_topup_amount ON public.wallet_refund_attempts(source_topup_id,amount)
  WHERE status IN ('pending','succeeded');
ALTER TABLE public.wallet_refund_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_refund_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.wallet_refund_attempts TO service_role;

CREATE FUNCTION public.claim_wallet_refund(p_email text,p_topup uuid,p_amount numeric,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t public.wallet_topups; a public.wallet_refund_attempts; available numeric; principal numeric;
BEGIN
  IF p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount <= 0
    OR p_amount*100 <> trunc(p_amount*100) OR nullif(p_request_key,'') IS NULL THEN RAISE EXCEPTION 'Invalid refund request'; END IF;
  INSERT INTO public.wallet_accounts(owner_email,currency) VALUES(p_email,'AUD') ON CONFLICT(owner_email,currency) DO NOTHING;
  PERFORM 1 FROM public.wallet_accounts WHERE owner_email=p_email AND currency='AUD' AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet account is not active'; END IF;
  SELECT * INTO a FROM public.wallet_refund_attempts WHERE affiliate_email=p_email AND status IN ('pending','succeeded')
    AND (request_key=p_request_key OR (source_topup_id=p_topup AND amount=p_amount)) LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('claimed',false,'attempt',to_jsonb(a)); END IF;
  SELECT * INTO t FROM public.wallet_topups WHERE id=p_topup AND affiliate_email=p_email FOR UPDATE;
  IF NOT FOUND OR coalesce(t.status,'') NOT IN ('','succeeded','refunded') THEN RAISE EXCEPTION 'Top-up not refundable'; END IF;
  principal := CASE WHEN coalesce(t.credited_amount,0)>0 THEN t.credited_amount ELSE coalesce(t.amount_net,0) END;
  available := public.launch_wallet_available_minor(p_email)/100;
  IF p_amount > available OR p_amount > principal-coalesce(t.amount_refunded,0) THEN RAISE EXCEPTION 'Insufficient refundable funds'; END IF;
  INSERT INTO public.wallet_refund_attempts(affiliate_email,source_topup_id,request_key,amount)
    VALUES(p_email,p_topup,p_request_key,p_amount) RETURNING * INTO a;
  -- Canonical balance, seg7 view and seg11 shadow ledger immediately exclude pending refunds.
  UPDATE public.wallet_topups SET amount_refunded=coalesce(amount_refunded,0)+p_amount WHERE id=t.id;
  RETURN jsonb_build_object('claimed',true,'attempt',to_jsonb(a));
END;
$$;

CREATE FUNCTION public.finish_wallet_refund(p_id uuid,p_status text,p_stripe_refund_id text DEFAULT NULL,
  p_charge_id text DEFAULT NULL,p_currency text DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.wallet_refund_attempts; owner text;
BEGIN
  SELECT affiliate_email INTO STRICT owner FROM public.wallet_refund_attempts WHERE id=p_id;
  PERFORM 1 FROM public.wallet_accounts WHERE owner_email=owner AND currency='AUD' FOR UPDATE;
  SELECT * INTO STRICT a FROM public.wallet_refund_attempts WHERE id=p_id FOR UPDATE;
  IF a.status <> 'pending' THEN RETURN to_jsonb(a); END IF;
  IF p_status NOT IN ('pending','succeeded','failed') OR p_status IS NULL THEN RAISE EXCEPTION 'Invalid refund status'; END IF;
  IF p_status='succeeded' THEN
    IF p_stripe_refund_id IS NULL OR p_currency IS DISTINCT FROM 'aud' THEN RAISE EXCEPTION 'Verified AUD Stripe refund required'; END IF;
    INSERT INTO public.wallet_refunds(affiliate_email,source_topup_id,stripe_refund_id,stripe_charge_id,amount,status,currency,currency_source)
      VALUES(a.affiliate_email,a.source_topup_id,p_stripe_refund_id,p_charge_id,a.amount,'succeeded','AUD','verified');
    UPDATE public.wallet_topups SET refunded_at=now(), status=CASE WHEN amount_refunded >=
      CASE WHEN coalesce(credited_amount,0)>0 THEN credited_amount ELSE amount_net END THEN 'refunded' ELSE status END
      WHERE id=a.source_topup_id;
  ELSIF p_status='failed' THEN
    UPDATE public.wallet_topups SET amount_refunded=amount_refunded-a.amount WHERE id=a.source_topup_id;
  END IF;
  UPDATE public.wallet_refund_attempts SET status=p_status,stripe_refund_id=coalesce(p_stripe_refund_id,stripe_refund_id),
    error_message=p_error,updated_at=now() WHERE id=p_id RETURNING * INTO a;
  RETURN to_jsonb(a);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_wallet_refund(text,uuid,numeric,text), public.finish_wallet_refund(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wallet_refund(text,uuid,numeric,text), public.finish_wallet_refund(uuid,text,text,text,text,text) TO service_role;
COMMIT;
