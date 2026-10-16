BEGIN;
CREATE TABLE public.fx_rates (
  base text NOT NULL CHECK (base IN ('USD','GBP','CAD')),
  quote text NOT NULL DEFAULT 'AUD' CHECK (quote = 'AUD'),
  rate numeric NOT NULL CHECK (rate > 0 AND rate::text NOT IN ('NaN','Infinity','-Infinity')),
  rate_date date NOT NULL,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(base,quote,rate_date,source)
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fx_rates FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fx_rates TO service_role;
ALTER TABLE public.wallet_holds
  ADD COLUMN original_amount numeric,
  ADD COLUMN original_currency text,
  ADD COLUMN fx_rate numeric,
  ADD COLUMN fx_source text,
  ADD COLUMN fx_rate_date date,
  ADD COLUMN fx_buffer_bps int;

-- Atomic metadata wrapper: original signature and AUD-only check stay intact.
CREATE FUNCTION public.reserve_launch_hold_fx(p_affiliate_email text, p_amount numeric,
  p_reference_id text, p_original_amount numeric, p_original_currency text,
  p_fx_rate numeric, p_fx_source text, p_fx_rate_date date, p_fx_buffer_bps int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE hold_id uuid; h public.wallet_holds;
BEGIN
  IF p_original_currency IS NULL OR p_original_currency NOT IN ('USD','GBP','CAD')
    OR p_original_amount IS NULL OR p_original_amount <= 0 OR p_original_amount::text IN ('NaN','Infinity','-Infinity')
    OR p_fx_rate IS NULL OR p_fx_rate <= 0 OR p_fx_rate::text IN ('NaN','Infinity','-Infinity')
    OR p_fx_source IS NULL OR p_fx_source NOT IN ('frankfurter','open.er-api')
    OR p_fx_rate_date IS NULL OR p_fx_rate_date > current_date
    OR p_fx_buffer_bps IS NULL OR p_fx_buffer_bps NOT BETWEEN 0 AND 10000
    OR p_amount IS NULL OR p_amount IS DISTINCT FROM ceil(p_original_amount*p_fx_rate*(1+p_fx_buffer_bps/10000::numeric)*100)/100 THEN
    RAISE EXCEPTION 'Invalid FX launch hold request';
  END IF;
  -- Delegation retains wallet locking, ownership, source accounting and idempotency.
  hold_id := public.reserve_launch_hold(p_affiliate_email,'AUD',p_amount,'ad_ideas',p_reference_id);
  SELECT * INTO STRICT h FROM public.wallet_holds WHERE id=hold_id FOR UPDATE;
  IF h.original_currency IS NOT NULL AND
    ROW(h.original_amount,h.original_currency,h.fx_rate,h.fx_source,h.fx_rate_date,h.fx_buffer_bps)
    IS DISTINCT FROM ROW(p_original_amount,p_original_currency,p_fx_rate,p_fx_source,p_fx_rate_date,p_fx_buffer_bps) THEN
    RAISE EXCEPTION 'Launch hold FX metadata changed';
  END IF;
  UPDATE public.wallet_holds SET original_amount=p_original_amount,original_currency=p_original_currency,
    fx_rate=p_fx_rate,fx_source=p_fx_source,fx_rate_date=p_fx_rate_date,fx_buffer_bps=p_fx_buffer_bps WHERE id=hold_id;
  RETURN hold_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_launch_hold_fx(text,numeric,text,numeric,text,numeric,text,date,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_launch_hold_fx(text,numeric,text,numeric,text,numeric,text,date,int) TO service_role;
COMMIT;
