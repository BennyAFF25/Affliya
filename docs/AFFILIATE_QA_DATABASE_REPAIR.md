# Affiliate QA database repair

Production read-only audit on 9 October 2026 confirmed public.inbox_messages and public.business_activation_subsidies are absent. These migrations are prepared, not applied.

Run these exact files in Supabase SQL Editor in order, or from a checked-out release:
```sh
psql "$NETTMARK_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20261009010000_affiliate_inbox_messages.sql
psql "$NETTMARK_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20261009010100_activation_subsidy_storage_compatibility.sql
```
NETTMARK_DATABASE_URL is a local operator connection string, not a new Vercel variable. Never paste it into chat.

Do not bulk-push unrelated pending migrations. The older 20260818143000_business_activation_subsidies.sql enables automatic A$10 grants using legacy subscription state. The compatibility repair creates empty storage, zero default and no automatic grant/reservation triggers or backfill.

Verify:
```sql
select to_regclass('public.inbox_messages'), to_regclass('public.business_activation_subsidies');
select tablename,policyname,cmd from pg_policies where schemaname='public' and tablename in ('inbox_messages','business_activation_subsidies');
select count(*) from public.business_activation_subsidies;
```
On this previously absent schema, the subsidy count should remain zero. Validate Inbox as separate sender, recipient and unrelated accounts. Clients can mark read/archive but cannot rewrite messages or issue credits.
Record the targeted migrations through the project's migration-history process if applying through SQL Editor/psql; these commands do not automatically update Supabase CLI migration history. Do not delete messages to roll back; revert UI code and retain storage.
