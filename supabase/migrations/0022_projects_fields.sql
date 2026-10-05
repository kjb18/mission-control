-- Project detail page: commercial fields on projects, plus the links from
-- rfqs / purchase_orders back to a project.

alter table public.projects
  add column if not exists client_id uuid references public.clients(id),
  add column if not exists client_name text,
  add column if not exists vat_type text default 'VAT Inclusive',
  add column if not exists deadline date,
  add column if not exists po_date date,
  add column if not exists invoice_date date,
  add column if not exists payment_terms text,
  add column if not exists payment_due_date date,
  add column if not exists payment_status text default 'Unpaid',
  add column if not exists invoice_amount numeric default 0,
  add column if not exists cogs numeric default 0,
  add column if not exists shipping_cost numeric default 0,
  add column if not exists notes text,
  add column if not exists stage text default 'Open',
  -- Not in the original spec: the Kanban health dot needs "stage unchanged
  -- for 30 days" and "no activity in 14 days", which need these two.
  add column if not exists stage_changed_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- "Link Existing RFQ / PO" needs somewhere to store the link.
alter table public.rfqs add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.purchase_orders add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists rfqs_project_id_idx on public.rfqs (project_id);
create index if not exists purchase_orders_project_id_idx on public.purchase_orders (project_id);

-- The spec asked for alter table sourcing_history, but no such table exists
-- in this schema (sourcing lives in rfq_lines + supplier_quotes), so the
-- Sourcing tab is derived from linked RFQs instead and nothing is added here.
