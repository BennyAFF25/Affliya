-- MANUAL ROLLBACK ONLY, never place in migrations/ or run as a forward migration.
-- Roll back application code first. This deletes pending grants and refresh credentials;
-- reconnect every store before running expiring-token application code again.
-- Existing access ciphertext remains under the original connected-token constraint.
-- Rolled-back legacy code cannot refresh it and it will expire (typically within an hour).
-- This is an emergency code/schema rollback, not a way to restore permanent tokens.
BEGIN;
DROP TABLE IF EXISTS public.shopify_pending_installs;
ALTER TABLE public.shopify_stores DROP CONSTRAINT IF EXISTS shopify_expiring_connected_token;
ALTER TABLE public.shopify_stores
  DROP COLUMN IF EXISTS refresh_token_encrypted,
  DROP COLUMN IF EXISTS access_token_expires_at,
  DROP COLUMN IF EXISTS refresh_token_expires_at;
COMMIT;
