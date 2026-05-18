ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_conversion_scope_check;

ALTER TABLE public.offers
  DROP COLUMN IF EXISTS eligible_variant_ids,
  DROP COLUMN IF EXISTS eligible_product_ids,
  DROP COLUMN IF EXISTS conversion_scope;
