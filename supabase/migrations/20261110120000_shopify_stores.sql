BEGIN;
CREATE TABLE public.shopify_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  shop_domain text UNIQUE NOT NULL CHECK (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  access_token_encrypted text,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('connected', 'disconnected', 'uninstalled')),
  installed_at timestamptz NOT NULL DEFAULT now(),
  uninstalled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopify_connected_token CHECK ((status = 'connected' AND access_token_encrypted IS NOT NULL) OR (status <> 'connected' AND access_token_encrypted IS NULL))
);
CREATE INDEX shopify_stores_business_id_idx ON public.shopify_stores(business_id);
ALTER TABLE public.shopify_stores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shopify_stores FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shopify_stores TO service_role;
-- No client policies: status is exposed only through the authenticated server route.
COMMIT;
