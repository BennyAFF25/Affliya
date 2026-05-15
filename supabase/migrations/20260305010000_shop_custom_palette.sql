-- Stage F: custom NettmarkShop palettes
ALTER TABLE public.affiliate_shop_settings
ADD COLUMN IF NOT EXISTS theme_json jsonb;
