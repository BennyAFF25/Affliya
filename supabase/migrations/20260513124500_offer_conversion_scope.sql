ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS conversion_scope text NOT NULL DEFAULT 'store_wide',
  ADD COLUMN IF NOT EXISTS eligible_product_ids jsonb,
  ADD COLUMN IF NOT EXISTS eligible_variant_ids jsonb;

UPDATE public.offers
SET conversion_scope = 'store_wide'
WHERE conversion_scope IS NULL OR conversion_scope = '';

UPDATE public.offers
SET eligible_product_ids = '[]'::jsonb
WHERE eligible_product_ids IS NULL;

UPDATE public.offers
SET eligible_variant_ids = '[]'::jsonb
WHERE eligible_variant_ids IS NULL;

ALTER TABLE public.offers
  ALTER COLUMN eligible_product_ids SET DEFAULT '[]'::jsonb,
  ALTER COLUMN eligible_variant_ids SET DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'offers_conversion_scope_check'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_conversion_scope_check
      CHECK (conversion_scope IN ('store_wide', 'specific_products'));
  END IF;
END $$;
