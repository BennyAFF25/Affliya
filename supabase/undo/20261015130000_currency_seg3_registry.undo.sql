-- Removes the registry and any subsequently maintained capability metadata.
BEGIN;

DROP TABLE IF EXISTS public.currency_registry;

COMMIT;
