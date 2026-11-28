-- Undo for 20261127121000_business_billing_notifications.sql. Export rows first if needed:
--   \copy (select * from public.business_billing_notifications) to 'business_billing_notifications.csv' csv header
drop table if exists public.business_billing_notifications;
