revoke all on function public.credit_wallet_topup(text,text,numeric,numeric,numeric,text) from public, anon, authenticated;
revoke all on function public.credit_wallet_topup(text,text,numeric,numeric,numeric,text,numeric,numeric) from public, anon, authenticated;
revoke all on function public.record_wallet_refund(text,uuid,text,text,numeric,text) from public, anon, authenticated;
revoke all on function public.settle_live_ad_spend(text) from public, anon, authenticated;
revoke all on function public.create_wallet_payouts_for_conversion(uuid,text,text,uuid,numeric,boolean,text,text,integer,timestamptz) from public, anon, authenticated;

grant execute on function public.credit_wallet_topup(text,text,numeric,numeric,numeric,text) to service_role;
grant execute on function public.credit_wallet_topup(text,text,numeric,numeric,numeric,text,numeric,numeric) to service_role;
grant execute on function public.record_wallet_refund(text,uuid,text,text,numeric,text) to service_role;
grant execute on function public.settle_live_ad_spend(text) to service_role;
grant execute on function public.create_wallet_payouts_for_conversion(uuid,text,text,uuid,numeric,boolean,text,text,integer,timestamptz) to service_role;
