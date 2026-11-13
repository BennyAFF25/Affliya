BEGIN;
ALTER TABLE public.shopify_stores
  ADD COLUMN pixel_id text,
  ADD COLUMN pixel_status text NOT NULL DEFAULT 'inactive' CHECK (pixel_status IN ('active', 'inactive', 'error')),
  ADD COLUMN pixel_error text CHECK (pixel_error IS NULL OR pixel_error IN ('extension_not_deployed', 'pixel_activation_failed')),
  ADD COLUMN pixel_updated_at timestamptz;

CREATE TABLE public.shopify_order_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain text NOT NULL REFERENCES public.shopify_stores(shop_domain) ON DELETE CASCADE,
  order_id text NOT NULL,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  tracking_event_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_domain, order_id)
);
CREATE INDEX shopify_order_conversions_business_idx ON public.shopify_order_conversions(business_id);
ALTER TABLE public.shopify_order_conversions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopify_order_conversions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shopify_order_conversions TO service_role;

-- One transaction reserves an order AND inserts its canonical event. Any failure rolls back both.
-- Invoker only: service role has access; no public/client execution or policies.
CREATE FUNCTION public.record_shopify_conversion(
  p_shop text, p_order text, p_business uuid, p_campaign uuid, p_offer uuid,
  p_affiliate text, p_amount numeric, p_currency text, p_event_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_event uuid := gen_random_uuid(); v_claim uuid;
BEGIN
  -- Lock the connection against disconnect/redaction while recording.
  PERFORM 1 FROM public.shopify_stores WHERE shop_domain = p_shop
    AND business_id = p_business AND status = 'connected' AND access_token_encrypted IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'store_unavailable'; END IF;
  INSERT INTO public.shopify_order_conversions(shop_domain, order_id, business_id, campaign_id, tracking_event_id)
  VALUES (p_shop, p_order, p_business, p_campaign, v_event)
  ON CONFLICT (shop_domain, order_id) DO NOTHING RETURNING id INTO v_claim;
  IF v_claim IS NULL THEN
    SELECT tracking_event_id INTO v_event FROM public.shopify_order_conversions WHERE shop_domain = p_shop AND order_id = p_order;
    RETURN jsonb_build_object('duplicate', true, 'event_id', v_event);
  END IF;
  INSERT INTO public.campaign_tracking_events(id, event_type, affiliate_id, campaign_id, offer_id, business_id, event_data, amount, currency, ip_address, user_agent)
  VALUES (v_event, 'conversion', p_affiliate, p_campaign, p_offer, p_business, p_event_data, p_amount, p_currency, NULL, NULL);
  RETURN jsonb_build_object('duplicate', false, 'event_id', v_event);
END;
$$;
REVOKE ALL ON FUNCTION public.record_shopify_conversion(text,text,uuid,uuid,uuid,text,numeric,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_shopify_conversion(text,text,uuid,uuid,uuid,text,numeric,text,jsonb) TO service_role;
COMMIT;
