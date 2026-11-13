BEGIN;
CREATE TABLE public.woocommerce_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_profiles(id),
  store_url text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','disconnected')),
  auth_nonce_hash text UNIQUE,
  auth_expires_at timestamptz,
  wc_key_id bigint,
  consumer_key_encrypted text,
  consumer_secret_encrypted text,
  webhook_secret_encrypted text,
  webhook_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(webhook_ids) = 'array'),
  tracking_status text NOT NULL DEFAULT 'inactive' CHECK (tracking_status IN ('active','inactive','error')),
  tracking_error text CHECK (tracking_error IS NULL OR tracking_error IN ('webhook_creation_failed')),
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX woocommerce_stores_business_status_idx ON public.woocommerce_stores(business_id,status);
CREATE TABLE public.woocommerce_order_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.woocommerce_stores(id) ON DELETE CASCADE,
  order_id text NOT NULL,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id),
  campaign_id uuid NOT NULL,
  tracking_event_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','reversed')),
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id,order_id)
);
ALTER TABLE public.woocommerce_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_order_conversions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.woocommerce_stores, public.woocommerce_order_conversions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.woocommerce_stores, public.woocommerce_order_conversions TO service_role;
CREATE FUNCTION public.record_woocommerce_conversion(
  p_store uuid, p_order text, p_business uuid, p_campaign uuid, p_offer uuid,
  p_affiliate text, p_amount numeric, p_currency text, p_event_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_event uuid := gen_random_uuid(); v_claim uuid;
BEGIN
  PERFORM 1 FROM public.woocommerce_stores WHERE id = p_store AND business_id = p_business
    AND status = 'connected' AND consumer_key_encrypted IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'store_unavailable'; END IF;
  INSERT INTO public.woocommerce_order_conversions(store_id,order_id,business_id,campaign_id,tracking_event_id)
  VALUES(p_store,p_order,p_business,p_campaign,v_event)
  ON CONFLICT(store_id,order_id) DO NOTHING RETURNING id INTO v_claim;
  IF v_claim IS NULL THEN
    SELECT tracking_event_id INTO v_event FROM public.woocommerce_order_conversions WHERE store_id=p_store AND order_id=p_order;
    RETURN jsonb_build_object('duplicate',true,'event_id',v_event);
  END IF;
  INSERT INTO public.campaign_tracking_events(id,event_type,affiliate_id,campaign_id,offer_id,business_id,event_data,amount,currency,ip_address,user_agent)
  VALUES(v_event,'conversion',p_affiliate,p_campaign,p_offer,p_business,p_event_data,p_amount,p_currency,NULL,NULL);
  RETURN jsonb_build_object('duplicate',false,'event_id',v_event);
END;
$$;
REVOKE ALL ON FUNCTION public.record_woocommerce_conversion(uuid,text,uuid,uuid,uuid,text,numeric,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_woocommerce_conversion(uuid,text,uuid,uuid,uuid,text,numeric,text,jsonb) TO service_role;
-- Existing offers identify businesses by email; do not assume an offers.business_id column.
CREATE FUNCTION public.woocommerce_offer_connected(p_offer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.offers o
    JOIN public.business_profiles b ON b.business_email=o.business_email
    JOIN public.woocommerce_stores w ON w.business_id=b.id AND w.status='connected'
    WHERE o.id=p_offer);
$$;
REVOKE ALL ON FUNCTION public.woocommerce_offer_connected(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.woocommerce_offer_connected(uuid) TO service_role;
COMMIT;
