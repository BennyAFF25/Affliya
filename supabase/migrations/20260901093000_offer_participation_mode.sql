ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS participation_mode text NOT NULL DEFAULT 'open';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'offers_participation_mode_check'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_participation_mode_check
      CHECK (participation_mode IN ('open', 'approval_required', 'private'));
  END IF;
END $$;

COMMENT ON COLUMN public.offers.participation_mode IS
  'Controls affiliate entry for the offer: open, approval_required, or private.';

CREATE OR REPLACE FUNCTION public.reserve_business_activation_subsidy_for_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participation_mode text;
BEGIN
  SELECT lower(coalesce(o.participation_mode, 'open'))
    INTO v_participation_mode
  FROM public.offers o
  WHERE o.id = NEW.offer_id;

  IF lower(coalesce(NEW.status, '')) = 'approved'
     AND (TG_OP = 'INSERT' OR lower(coalesce(OLD.status, '')) <> 'approved')
     AND coalesce(v_participation_mode, 'open') <> 'open' THEN
    WITH candidate AS (
      SELECT bas.id
      FROM public.business_activation_subsidies bas
      WHERE bas.offer_id = NEW.offer_id
        AND bas.status = 'available'
      ORDER BY bas.created_at ASC
      LIMIT 1
    )
    UPDATE public.business_activation_subsidies bas
    SET status = 'reserved',
        reserved_for_affiliate_email = NEW.affiliate_email,
        approved_request_id = NEW.id,
        reserved_at = now(),
        updated_at = now()
    WHERE bas.id IN (SELECT id FROM candidate);
  ELSIF TG_OP = 'UPDATE'
    AND lower(coalesce(OLD.status, '')) = 'approved'
    AND lower(coalesce(NEW.status, '')) <> 'approved' THEN
    UPDATE public.business_activation_subsidies bas
    SET status = 'available',
        reserved_for_affiliate_email = NULL,
        approved_request_id = NULL,
        reserved_at = NULL,
        updated_at = now()
    WHERE bas.approved_request_id = NEW.id
      AND bas.status = 'reserved'
      AND bas.consumed_amount = 0;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.business_activation_subsidies bas
SET status = 'available',
    reserved_for_affiliate_email = NULL,
    approved_request_id = NULL,
    reserved_at = NULL,
    updated_at = now()
FROM public.offers o
WHERE bas.offer_id = o.id
  AND lower(coalesce(o.participation_mode, 'open')) = 'open'
  AND bas.status = 'reserved'
  AND bas.consumed_amount = 0;
