-- Additive preparation only; apply separately under an authorized staging release.
BEGIN;
ALTER TABLE public.shopify_stores
  ADD COLUMN refresh_token_encrypted text,
  ADD COLUMN access_token_expires_at timestamptz,
  ADD COLUMN refresh_token_expires_at timestamptz;
-- NOT VALID leaves legacy connected rows readable without transforming production data.
-- New inserts/updates require expiring credentials. Legacy stores must OAuth again;
-- the server marks them disconnected before attempting further Admin API calls.
ALTER TABLE public.shopify_stores ADD CONSTRAINT shopify_expiring_connected_token CHECK (
  (status = 'connected' AND access_token_encrypted IS NOT NULL AND refresh_token_encrypted IS NOT NULL
    AND access_token_expires_at IS NOT NULL AND refresh_token_expires_at IS NOT NULL)
  OR (status <> 'connected' AND access_token_encrypted IS NULL AND refresh_token_encrypted IS NULL
    AND access_token_expires_at IS NULL AND refresh_token_expires_at IS NULL)
) NOT VALID;

CREATE TABLE public.shopify_pending_installs (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{43}$'),
  shop_domain text NOT NULL CHECK (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  refresh_token_expires_at timestamptz NOT NULL,
  scopes text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK ((user_id IS NULL AND business_id IS NULL) OR (user_id IS NOT NULL AND business_id IS NOT NULL)),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '1 hour 1 minute')
);
CREATE INDEX shopify_pending_installs_expiry_idx ON public.shopify_pending_installs(expires_at);
CREATE INDEX shopify_pending_installs_shop_idx ON public.shopify_pending_installs(shop_domain);
ALTER TABLE public.shopify_pending_installs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shopify_pending_installs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shopify_pending_installs TO service_role;
-- No client policies. Tokens never appear in client projections.
COMMIT;
