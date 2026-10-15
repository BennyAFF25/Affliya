-- Segment 9: dormant account identities only; existing wallets and ledgers stay authoritative.
BEGIN;

CREATE TABLE public.wallet_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  owner_user_id uuid NULL,
  owner_role text NOT NULL DEFAULT 'affiliate' CHECK (owner_role IN ('affiliate', 'business', 'platform')),
  currency text NOT NULL REFERENCES public.currency_registry(code),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_email, currency)
);

CREATE INDEX wallet_accounts_owner_user_id_idx ON public.wallet_accounts (owner_user_id);
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
-- No client policies. Explicitly remove inherited/default public and client grants.
REVOKE ALL ON public.wallet_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.wallet_accounts TO service_role;

-- Stable IDs exist, but schema evidence does not prove an unambiguous email join.
INSERT INTO public.wallet_accounts (owner_email, owner_user_id, owner_role, currency)
SELECT w.email, NULL::uuid,
  CASE WHEN w.role IN ('affiliate', 'business', 'platform') THEN w.role ELSE 'affiliate' END,
  'AUD'
FROM public.wallets w
ON CONFLICT (owner_email, currency) DO NOTHING;

DO $$
DECLARE
  wallet_count bigint;
  account_count bigint;
BEGIN
  SELECT count(*) INTO wallet_count FROM public.wallets;
  SELECT count(*) INTO account_count FROM public.wallet_accounts WHERE currency = 'AUD';
  IF account_count <> wallet_count THEN
    RAISE EXCEPTION 'Segment 9 AUD account count % does not match wallet count %', account_count, wallet_count;
  END IF;
END;
$$;

COMMENT ON TABLE public.wallet_accounts IS
  'Identity-only per-currency wallet accounts; no balances. Not yet authoritative; no runtime readers or writers. Existing wallets and ledgers are unchanged.';

COMMIT;
