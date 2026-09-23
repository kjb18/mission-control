-- Mission Control — initial schema
-- Ultra Power Industrial Resources, Inc.
-- Single-user app: all RLS policies restrict access to one authenticated
-- email address (the owner's magic-link login).

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Helper: identifies the single authorized user by email on their JWT.
-- Using a function keeps the owner email in one place; update it if the
-- login address ever changes.
-- ---------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = 'khalil@ultrapowerindustrialresources.com',
    false
  );
$$;

-- ---------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  address text,
  website text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_status_idx on public.clients (status);

-- ---------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_client_id_idx on public.contacts (client_id);

-- ---------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  contact_name text,
  email text,
  phone text,
  website text,
  rating integer check (rating between 1 and 5),
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suppliers_status_idx on public.suppliers (status);

-- ---------------------------------------------------------------------
-- part_signatures
-- Canonical part records used to match line items across RFQs/quotes.
-- ---------------------------------------------------------------------
create table public.part_signatures (
  id uuid primary key default gen_random_uuid(),
  part_number text not null,
  manufacturer text,
  description text,
  category text,
  unit text default 'ea',
  specs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index part_signatures_part_number_manufacturer_idx
  on public.part_signatures (part_number, coalesce(manufacturer, ''));

-- ---------------------------------------------------------------------
-- rfqs
-- ---------------------------------------------------------------------
create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  rfq_number text,
  title text not null,
  status text not null default 'open',
  received_date date,
  closing_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rfqs_status_idx on public.rfqs (status);
create index rfqs_closing_date_idx on public.rfqs (closing_date);
create index rfqs_client_id_idx on public.rfqs (client_id);

-- ---------------------------------------------------------------------
-- rfq_lines
-- ---------------------------------------------------------------------
create table public.rfq_lines (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  part_signature_id uuid references public.part_signatures (id) on delete set null,
  line_number integer,
  description text,
  quantity numeric not null default 1,
  unit text default 'ea',
  target_price numeric,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rfq_lines_rfq_id_idx on public.rfq_lines (rfq_id);
create index rfq_lines_part_signature_id_idx on public.rfq_lines (part_signature_id);
create index rfq_lines_status_idx on public.rfq_lines (status);

-- ---------------------------------------------------------------------
-- supplier_quotes
-- ---------------------------------------------------------------------
create table public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_line_id uuid not null references public.rfq_lines (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  unit_price numeric,
  lead_time_days integer,
  quoted_at date,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index supplier_quotes_rfq_line_id_idx on public.supplier_quotes (rfq_line_id);
create index supplier_quotes_supplier_id_idx on public.supplier_quotes (supplier_id);
create index supplier_quotes_status_idx on public.supplier_quotes (status);

-- ---------------------------------------------------------------------
-- quotations
-- Quote issued to the client, built from an RFQ.
-- ---------------------------------------------------------------------
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid references public.rfqs (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  quote_number text,
  status text not null default 'draft',
  total_amount numeric,
  sent_date date,
  closing_date date,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotations_status_idx on public.quotations (status);
create index quotations_closing_date_idx on public.quotations (closing_date);
create index quotations_client_id_idx on public.quotations (client_id);
create index quotations_rfq_id_idx on public.quotations (rfq_id);

-- ---------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.quotations (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  po_number text,
  status text not null default 'open',
  total_amount numeric,
  order_date date,
  expected_delivery_date date,
  closing_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_orders_closing_date_idx on public.purchase_orders (closing_date);
create index purchase_orders_client_id_idx on public.purchase_orders (client_id);
create index purchase_orders_quotation_id_idx on public.purchase_orders (quotation_id);

-- ---------------------------------------------------------------------
-- deliveries
-- ---------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  status text not null default 'pending',
  delivery_date date,
  tracking_number text,
  carrier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deliveries_purchase_order_id_idx on public.deliveries (purchase_order_id);
create index deliveries_status_idx on public.deliveries (status);

-- ---------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  invoice_number text,
  status text not null default 'unpaid',
  amount numeric,
  issued_date date,
  due_date date,
  paid_date date,
  closing_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_status_idx on public.invoices (status);
create index invoices_closing_date_idx on public.invoices (closing_date);
create index invoices_purchase_order_id_idx on public.invoices (purchase_order_id);
create index invoices_client_id_idx on public.invoices (client_id);

-- ---------------------------------------------------------------------
-- daily_logs
-- Backs the daily check-in gate (energy, feeling, gratitude) plus MITs.
-- ---------------------------------------------------------------------
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  energy_level integer check (energy_level between 1 and 5),
  feeling text,
  gratitude text,
  mits jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index daily_logs_status_idx on public.daily_logs (status);
create index daily_logs_log_date_idx on public.daily_logs (log_date);

-- ---------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cadence text not null default 'daily',
  target_per_period integer default 1,
  status text not null default 'active',
  streak_count integer not null default 0,
  last_completed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index habits_status_idx on public.habits (status);

-- ---------------------------------------------------------------------
-- okrs
-- ---------------------------------------------------------------------
create table public.okrs (
  id uuid primary key default gen_random_uuid(),
  objective text not null,
  quarter text,
  key_results jsonb not null default '[]'::jsonb,
  status text not null default 'on_track',
  progress numeric not null default 0,
  closing_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index okrs_status_idx on public.okrs (status);
create index okrs_closing_date_idx on public.okrs (closing_date);

-- ---------------------------------------------------------------------
-- updated_at trigger for every table that has the column
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clients','contacts','suppliers','part_signatures','rfqs','rfq_lines',
      'supplier_quotes','quotations','purchase_orders','deliveries',
      'invoices','daily_logs','habits','okrs'
    ])
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security — single-user access only
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clients','contacts','suppliers','part_signatures','rfqs','rfq_lines',
      'supplier_quotes','quotations','purchase_orders','deliveries',
      'invoices','daily_logs','habits','okrs'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "owner_full_access" on public.%I
       for all using (public.is_owner()) with check (public.is_owner());', t
    );
  end loop;
end $$;
