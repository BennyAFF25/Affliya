-- Undo for 20261127120000_legal_acceptances.sql.
-- legal_acceptances is legal evidence: export it first if it has rows, e.g.
--   \copy (select * from public.legal_acceptances) to 'legal_acceptances.csv' csv header
alter table public.profiles drop column if exists terms_version;
drop table if exists public.legal_acceptances;
