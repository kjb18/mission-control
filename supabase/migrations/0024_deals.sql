-- Pipeline deals: one deal per RFQ, with its own commercial fields, expenses
-- and documents. Separate from Planning projects (projects / 0017, 0022).
-- RLS uses public.is_owner() like the rest of the schema, not auth.uid() is not null.

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid references public.rfqs(id),
  rfq_number text,
  client_name text,
  title text,
  status text default 'intake_confirmed',
  stage text default 'intake_confirmed',
  vat_type text default 'VAT Inclusive',
  received_date date,
  closing_date date,
  po_date date,
  invoice_date date,
  payment_terms text,
  payment_due_date date,
  payment_status text default 'Unpaid',
  invoice_amount numeric default 0,
  cogs numeric default 0,
  shipping_cost numeric default 0,
  gross_profit numeric generated always as (invoice_amount - cogs - shipping_cost) stored,
  gross_margin_percent numeric generated always as (
    case when invoice_amount > 0 then round(((invoice_amount - cogs - shipping_cost) / invoice_amount) * 100, 1) else 0 end
  ) stored,
  notes text,
  stage_changed_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists deals_rfq_id_idx on public.deals (rfq_id);
-- One deal per RFQ, so concurrent first loads can't create duplicates.
create unique index if not exists deals_rfq_id_unique on public.deals (rfq_id) where rfq_id is not null;

drop trigger if exists set_updated_at on public.deals;
create trigger set_updated_at before update on public.deals
  for each row execute function public.set_updated_at();

alter table public.deals enable row level security;
drop policy if exists "owner_all" on public.deals;
create policy "owner_all" on public.deals for all using (public.is_owner()) with check (public.is_owner());

alter table public.rfqs add column if not exists deal_id uuid references public.deals(id) on delete set null;
create index if not exists rfqs_deal_id_idx on public.rfqs (deal_id);

create table if not exists public.deal_expenses (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
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
create index if not exists deal_expenses_deal_id_idx on public.deal_expenses (deal_id);

alter table public.deal_expenses enable row level security;
drop policy if exists "owner_all" on public.deal_expenses;
create policy "owner_all" on public.deal_expenses for all using (public.is_owner()) with check (public.is_owner());

create table if not exists public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size integer,
  uploaded_at timestamptz default now()
);
create index if not exists deal_documents_deal_id_idx on public.deal_documents (deal_id);

alter table public.deal_documents enable row level security;
drop policy if exists "owner_all" on public.deal_documents;
create policy "owner_all" on public.deal_documents for all using (public.is_owner()) with check (public.is_owner());

insert into storage.buckets (id, name, public)
values ('deal-documents', 'deal-documents', false)
on conflict (id) do nothing;

drop policy if exists "owner_all_deal_docs" on storage.objects;
create policy "owner_all_deal_docs" on storage.objects
  for all using (bucket_id = 'deal-documents' and public.is_owner())
  with check (bucket_id = 'deal-documents' and public.is_owner());
