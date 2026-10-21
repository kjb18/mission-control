-- Logistics: freight forwarders, customs brokers and other logistics partners.
-- RLS uses public.is_owner() like the rest of the schema, not auth.uid() is not null.

create table if not exists public.logistics_forwarders (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  trading_name text,
  type text[] default '{}',
  primary_contact text,
  phone text,
  email text,
  modes text[] default '{}',
  ports_covered text,
  warehousing boolean default false,
  customs_brokerage boolean default false,
  service_areas text[] default '{}',
  payment_terms text,
  incoterms text[] default '{}',
  currency text default 'PHP',
  account_number text,
  account_manager text,
  first_used date,
  rating integer check (rating >= 1 and rating <= 5),
  preferred_status text default 'backup',
  accreditation_number text,
  insurance_details text,
  last_used date,
  status text default 'active',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.logistics_forwarders enable row level security;

drop policy if exists "owner_all" on public.logistics_forwarders;
create policy "owner_all" on public.logistics_forwarders
  for all using (public.is_owner()) with check (public.is_owner());

drop trigger if exists set_updated_at on public.logistics_forwarders;
create trigger set_updated_at before update on public.logistics_forwarders
  for each row execute function public.set_updated_at();
