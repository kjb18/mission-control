-- Alerts raised by the Pipeline page, e.g. quotations auto-rejected after
-- 45 days without an award. Shown as a dismissible banner on the homepage.
create table if not exists public.rfq_alerts (
  id uuid primary key default gen_random_uuid(),
  rfq_number text not null,
  alert_type text default 'rejected',
  created_at timestamptz default now(),
  dismissed boolean default false
);

alter table public.rfq_alerts enable row level security;
drop policy if exists "owner_all" on public.rfq_alerts;
create policy "owner_all" on public.rfq_alerts
  for all using (public.is_owner()) with check (public.is_owner());
