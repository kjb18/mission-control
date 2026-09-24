-- Sourcing Desk: winning-quote tracking, per-quote brand/certification,
-- supplier blacklist.

alter table public.rfq_lines
  add column winning_supplier_quote_id uuid references public.supplier_quotes (id) on delete set null;

alter table public.supplier_quotes
  add column brand text,
  add column certified boolean not null default false;

alter table public.suppliers
  add column is_blacklisted boolean not null default false;

-- Migrate RFQs created before this session's status lifecycle existed:
-- "open" meant "just created, not yet worked on", the same thing
-- "intake_confirmed" means now — carry them forward so nothing already in
-- the pipeline goes missing from the Sourcing Desk.
update public.rfqs set status = 'intake_confirmed' where status = 'open';

-- Pre-populate the blacklist. Update existing rows if present, insert if
-- not — suppliers.name has no unique constraint, so this stays a plain
-- conditional insert rather than an upsert.
update public.suppliers set is_blacklisted = true
  where lower(name) in ('khm megatools', 'goldpeak tools');

insert into public.suppliers (name, is_blacklisted)
select v.name, true
from (values ('KHM Megatools'), ('Goldpeak Tools')) as v(name)
where not exists (
  select 1 from public.suppliers s where lower(s.name) = lower(v.name)
);
