-- Quote Builder, Pipeline Kanban, and the settings table.
--
-- Status lifecycle note: prior sessions defined intake_confirmed (Intake
-- confirm) and sourced (Sourcing Desk, once every line is sourced), with
-- nothing in between. The Pipeline board needs five *meaningfully
-- distinct* columns (Intake, Sourcing, Quoted, Awarded, Delivered), so
-- this migration doesn't add schema for it (status stays plain text) but
-- the application now also uses:
--   sourcing   — set the moment the first supplier quote is logged/selected
--                on an RFQ still at intake_confirmed (src/lib/sourcing.js)
--   quoted     — set on Quote Builder send (this session)
--   awarded, delivered — no automated trigger yet; set by dragging a card
--                on the Pipeline board itself (src/pages/Pipeline.jsx)

-- Singleton settings table (Task 1: FX rate, editable from Settings).
create table public.app_settings (
  id boolean primary key default true,
  fx_rate numeric not null default 57.80,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

create trigger set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
create policy "owner_full_access" on public.app_settings
  for all using (public.is_owner()) with check (public.is_owner());

insert into public.app_settings (id, fx_rate) values (true, 57.80);

-- Quotation record needs to capture the actual computed values sent, not
-- just a single total — an immutable snapshot independent of rfq_lines /
-- supplier_quotes potentially changing later.
alter table public.quotations
  add column subtotal numeric,
  add column vat_amount numeric,
  add column blended_margin_percent numeric,
  add column fx_rate_used numeric,
  add column pdf_url text,
  add column line_items jsonb;

-- Storage bucket for generated quotation PDFs. Private — the
-- render-quotation Edge Function (service role) is the only writer, and
-- hands back a signed URL for the client to preview/download/email.
insert into storage.buckets (id, name, public)
values ('quotations', 'quotations', false)
on conflict (id) do nothing;

-- Realtime: Pipeline board needs to react to rfqs.status changes made
-- anywhere (Intake, Sourcing Desk, Quote Builder, or the board itself)
-- without a manual refresh.
alter publication supabase_realtime add table public.rfqs;
