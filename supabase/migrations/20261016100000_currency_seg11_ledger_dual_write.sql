-- Shadow only; no application balance or original money-write changes.
BEGIN;

CREATE FUNCTION public.shadow_ledger_sync_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row jsonb;
  v_account uuid;
  v_credited numeric := 0;
  v_net numeric := 0;
  v_refunded numeric := 0;
  v_principal numeric;
  v_credit numeric := 0;
  v_refund numeric := 0;
  v_adjustment numeric := 0;
  v_deduction numeric := 0;
  v_reason text;
  v_error text;
  v_state text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  -- Delete all old contribution types on deletion, key changes or skipped mappings.
  -- The exception subtransaction rolls this cleanup back if a later sync write fails.
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.wallet_ledger_entries
    WHERE source_table = TG_TABLE_NAME AND source_id = OLD.id::text
      AND OLD.id::text IS DISTINCT FROM NEW.id::text;
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.wallet_ledger_entries
    WHERE source_table = TG_TABLE_NAME AND source_id = v_row->>'id';
    RETURN NULL;
  END IF;

  SELECT id INTO v_account FROM public.wallet_accounts
  WHERE owner_email = v_row->>'affiliate_email' AND currency = v_row->>'currency';
  IF v_row->>'currency' IS NULL THEN
    v_reason := 'SHADOW_LEDGER_CURRENCY_UNRECORDED';
  ELSIF v_account IS NULL THEN
    INSERT INTO public.wallet_accounts (owner_email, currency)
    SELECT v_row->>'affiliate_email', r.code FROM public.currency_registry r
    WHERE r.code = v_row->>'currency' AND r.wallet_enabled = true
    ON CONFLICT (owner_email, currency) DO NOTHING;
    SELECT id INTO v_account FROM public.wallet_accounts
    WHERE owner_email = v_row->>'affiliate_email' AND currency = v_row->>'currency';
    IF v_account IS NULL THEN v_reason := 'SHADOW_LEDGER_ACCOUNT_UNAVAILABLE'; END IF;
  END IF;
  -- SEG10 explicitly required two-decimal account currencies. Do not infer units.
  IF v_reason IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.currency_registry
    WHERE code = v_row->>'currency' AND minor_unit_exponent = 2
  ) THEN v_reason := 'SHADOW_LEDGER_UNSUPPORTED_PRECISION'; END IF;

  IF v_reason IS NULL THEN
    IF TG_TABLE_NAME = 'wallet_topups'
      AND COALESCE(lower(v_row->>'status'), '') IN ('', 'succeeded', 'refunded') THEN
      v_credited := CASE WHEN v_row->>'credited_amount' IS NULL
        OR v_row->>'credited_amount' IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric
        ELSE floor((v_row->>'credited_amount')::double precision * 100 + 0.5)::numeric END;
      v_net := CASE WHEN v_row->>'amount_net' IS NULL
        OR v_row->>'amount_net' IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric
        ELSE floor((v_row->>'amount_net')::double precision * 100 + 0.5)::numeric END;
      v_refunded := CASE WHEN v_row->>'amount_refunded' IS NULL
        OR v_row->>'amount_refunded' IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric
        ELSE floor((v_row->>'amount_refunded')::double precision * 100 + 0.5)::numeric END;
      v_principal := CASE WHEN v_credited > 0 THEN v_credited ELSE v_net END;
      v_credit := greatest(0, v_principal);
      v_refund := -least(greatest(0, v_principal), greatest(0, v_refunded));
      v_adjustment := greatest(0, v_principal - v_refunded) - v_credit - v_refund;
    ELSIF TG_TABLE_NAME = 'wallet_deductions' THEN
      v_deduction := CASE WHEN v_row->>'amount' IS NULL
        OR v_row->>'amount' IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric
        ELSE -floor((v_row->>'amount')::double precision * 100 + 0.5)::numeric END;
    END IF;
    -- wallet_refunds is audit-only: all desired contributions stay zero.
  END IF;

  DELETE FROM public.wallet_ledger_entries e
  WHERE e.source_table = TG_TABLE_NAME AND e.source_id = v_row->>'id'
    AND NOT EXISTS (
      SELECT 1 FROM (VALUES ('topup_credit', v_credit), ('refund_debit', v_refund),
        ('adjustment', v_adjustment), ('deduction_debit', v_deduction)) d(entry_type, amount)
      WHERE d.entry_type = e.entry_type AND d.amount <> 0
    );
  INSERT INTO public.wallet_ledger_entries
    (account_id, currency, entry_type, amount_minor, source_table, source_id, occurred_at, metadata)
  SELECT v_account, v_row->>'currency', d.entry_type, d.amount::bigint,
    TG_TABLE_NAME, v_row->>'id', (v_row->>'created_at')::timestamptz,
    jsonb_build_object('shadow_dual_write', true, 'refund_rule', 'embedded_only')
  FROM (VALUES ('topup_credit', v_credit), ('refund_debit', v_refund),
    ('adjustment', v_adjustment), ('deduction_debit', v_deduction)) d(entry_type, amount)
  WHERE d.amount <> 0
  ON CONFLICT (source_table, source_id, entry_type) DO UPDATE
  SET account_id = EXCLUDED.account_id, currency = EXCLUDED.currency,
    amount_minor = EXCLUDED.amount_minor, occurred_at = EXCLUDED.occurred_at,
    metadata = EXCLUDED.metadata;

  IF v_reason IS NOT NULL THEN
    BEGIN
      INSERT INTO public.money_flow_audit_log
        (id, created_at, event_type, severity, source_route, entity_type, entity_id,
         affiliate_email, wallet_topup_id, wallet_refund_id, wallet_deduction_id,
         reason_code, message, metadata)
      VALUES (gen_random_uuid(), now(), 'shadow_ledger_sync_failed', 'warning',
        'currency_seg11_ledger_dual_write', TG_TABLE_NAME, v_row->>'id',
        v_row->>'affiliate_email',
        CASE WHEN TG_TABLE_NAME = 'wallet_topups' THEN v_row->>'id' END,
        CASE WHEN TG_TABLE_NAME = 'wallet_refunds' THEN v_row->>'id' END,
        CASE WHEN TG_TABLE_NAME = 'wallet_deductions' THEN v_row->>'id' END,
        v_reason, 'Shadow ledger sync skipped or failed; canonical write preserved',
        jsonb_build_object('operation', TG_OP, 'currency', v_row->>'currency',
          'sqlerrm', v_error, 'sqlstate', v_state));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  v_error := SQLERRM;
  v_state := SQLSTATE;
  v_reason := 'SHADOW_LEDGER_SYNC_FAILED';
  BEGIN
      INSERT INTO public.money_flow_audit_log
        (id, created_at, event_type, severity, source_route, entity_type, entity_id,
         affiliate_email, wallet_topup_id, wallet_refund_id, wallet_deduction_id,
         reason_code, message, metadata)
      VALUES (gen_random_uuid(), now(), 'shadow_ledger_sync_failed', 'warning',
        'currency_seg11_ledger_dual_write', TG_TABLE_NAME, v_row->>'id',
        v_row->>'affiliate_email',
        CASE WHEN TG_TABLE_NAME = 'wallet_topups' THEN v_row->>'id' END,
        CASE WHEN TG_TABLE_NAME = 'wallet_refunds' THEN v_row->>'id' END,
        CASE WHEN TG_TABLE_NAME = 'wallet_deductions' THEN v_row->>'id' END,
        v_reason, 'Shadow ledger sync skipped or failed; canonical write preserved',
        jsonb_build_object('operation', TG_OP, 'currency', v_row->>'currency',
          'sqlerrm', v_error, 'sqlstate', v_state));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.shadow_ledger_sync_source() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER shadow_ledger_sync_wallet_topups
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_topups
FOR EACH ROW EXECUTE FUNCTION public.shadow_ledger_sync_source();

CREATE TRIGGER shadow_ledger_sync_wallet_refunds
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_refunds
FOR EACH ROW EXECUTE FUNCTION public.shadow_ledger_sync_source();

CREATE TRIGGER shadow_ledger_sync_wallet_deductions
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_deductions
FOR EACH ROW EXECUTE FUNCTION public.shadow_ledger_sync_source();

CREATE VIEW public.wallet_ledger_reconciliation WITH (security_invoker = true) AS
SELECT COALESCE(c.affiliate_email, l.owner_email) AS affiliate_email,
  COALESCE(c.currency_bucket, l.currency) AS currency,
  COALESCE(c.available * 100, 0::numeric) AS canonical_minor,
  COALESCE(l.ledger_balance_minor, 0::numeric) AS ledger_minor,
  COALESCE(l.ledger_balance_minor, 0::numeric) - COALESCE(c.available * 100, 0::numeric) AS drift_minor,
  COALESCE(l.ledger_balance_minor, 0::numeric) <> COALESCE(c.available * 100, 0::numeric) AS has_drift,
  c.currency_bucket IS NULL AS canonical_missing,
  l.account_id IS NULL AS ledger_missing,
  COALESCE((c.topups_net_available - c.deducted_total) * 100, 0::numeric) AS canonical_before_floor_minor,
  COALESCE(c.topups_net_available < c.deducted_total, false) AS canonical_floor_applied,
  'Canonical available is zero-floored; raw shadow balances can be negative. SEG10 account floor adjustments are retained snapshots, not refreshed by row sync.'::text AS floor_explanation
FROM public.affiliate_wallet_balances_by_currency c
FULL JOIN public.wallet_ledger_balances l
  ON l.owner_email = c.affiliate_email AND l.currency = c.currency_bucket;
REVOKE ALL ON public.wallet_ledger_reconciliation FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.wallet_ledger_reconciliation TO service_role;
COMMENT ON VIEW public.wallet_ledger_reconciliation IS
  'Shadow diagnostic only; drift_minor = ledger minus canonical. Includes missing sides; zero-floor and historical account adjustments can explain drift.';
COMMENT ON FUNCTION public.shadow_ledger_sync_source() IS
  'Best-effort SEG10 row contribution sync. Errors and audit failures are isolated; refunds audit-only. No final account floor recalculation.';
COMMIT;
