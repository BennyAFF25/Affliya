BEGIN;
DROP TRIGGER IF EXISTS segA_deduction_hold ON public.wallet_deductions;
DROP TRIGGER IF EXISTS segA_idea_hold ON public.ad_ideas;
DROP TRIGGER IF EXISTS segA_ad_hold ON public.live_ads;
DROP FUNCTION IF EXISTS public.segA_hold_lifecycle();
DROP FUNCTION IF EXISTS public.consume_launch_hold(text);
DROP TABLE IF EXISTS public.launch_hold_consumptions;
DROP FUNCTION IF EXISTS public.release_launch_hold(text,text);
DROP FUNCTION IF EXISTS public.reserve_launch_hold(text,text,numeric,text,text);
DROP FUNCTION IF EXISTS public.get_launch_source_reserved(text,uuid,text);
DROP FUNCTION IF EXISTS public.get_launch_wallet_available(text,text);
DROP FUNCTION IF EXISTS public.launch_wallet_available_minor(text,text);
DROP INDEX IF EXISTS public.segA_launch_hold_reference;
-- Runtime holds are discarded on rollback; deploy the previous app first.
DELETE FROM public.wallet_holds WHERE launch_remaining_minor IS NOT NULL;
ALTER TABLE public.wallet_holds DROP COLUMN launch_remaining_minor, DROP COLUMN launch_wallet_minor,
 DROP COLUMN launch_offer_id, DROP COLUMN launch_source_minor;
COMMIT;
