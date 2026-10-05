-- Per-project expense ledger for the Project detail page.
-- RLS uses public.is_owner() like every other table here (the original spec
-- used auth.uid() is not null, which would let any signed-in user in).

create table if not exists public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('COGS','Shipping Cost','Shipping Revenue','Project Expense','OpEx')),
  category text,
  description text not null,
  amount numeric not null default 0,
  vat_applicable boolean default false,
  vat_amount numeric not null default 0,
  net_amount numeric generated always as (amount + vat_amount) stored,
  created_at timestamptz default now()
);

create index if not exists project_expenses_project_id_idx on public.project_expenses (project_id);

alter table public.project_expenses enable row level security;
drop policy if exists "owner_all" on public.project_expenses;
create policy "owner_all" on public.project_expenses
  for all using (public.is_owner()) with check (public.is_owner());
