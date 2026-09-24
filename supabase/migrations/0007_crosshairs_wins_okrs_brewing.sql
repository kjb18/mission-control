-- Crosshairs targets + touchpoints + daily rotation, Wins (auto-created
-- via trigger on rfqs.status='awarded'), OKR tracker fields, Brewing.

-- ---------------------------------------------------------------------
-- Crosshairs
-- ---------------------------------------------------------------------
create table public.crosshairs_targets (
  id uuid primary key default gen_random_uuid(),
  target_name text not null,
  industry text,
  priority text not null default 'Medium' check (priority in ('Hot', 'Medium', 'Low', 'Nurturing')),
  estimated_value numeric,
  primary_contact_name text,
  current_stage text,
  last_touchpoint_date date,
  next_suggested_action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crosshairs_targets_priority_idx on public.crosshairs_targets (priority);
create index crosshairs_targets_last_touchpoint_idx on public.crosshairs_targets (last_touchpoint_date);

create trigger set_updated_at before update on public.crosshairs_targets
  for each row execute function public.set_updated_at();

alter table public.crosshairs_targets enable row level security;
create policy "owner_full_access" on public.crosshairs_targets
  for all using (public.is_owner()) with check (public.is_owner());

-- Touchpoint history — target.last_touchpoint_date is kept in sync (app
-- code sets both in the same call) so the card list can sort without a
-- join, while the full log lives here.
create table public.crosshairs_touchpoints (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.crosshairs_targets (id) on delete cascade,
  touchpoint_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index crosshairs_touchpoints_target_id_idx on public.crosshairs_touchpoints (target_id);

alter table public.crosshairs_touchpoints enable row level security;
create policy "owner_full_access" on public.crosshairs_touchpoints
  for all using (public.is_owner()) with check (public.is_owner());

-- Daily rotation cache: which target is "today's featured target" for the
-- homepage Crosshairs panel, computed once per day and held stable for
-- the rest of that day regardless of touchpoints logged in the meantime.
alter table public.daily_logs
  add column crosshairs_rotation jsonb;

-- ---------------------------------------------------------------------
-- Wins — auto-created when an RFQ is awarded, from wherever that happens
-- (PO receipt form, or a manual Pipeline board drag), via trigger rather
-- than scattered client-side calls, so it's guaranteed exactly-once
-- regardless of which code path flips the status.
-- ---------------------------------------------------------------------
create table public.wins (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid references public.rfqs (id) on delete set null,
  client_name text not null,
  rfq_reference text,
  awarded_date date not null default current_date,
  total_value numeric,
  margin_percent numeric,
  created_at timestamptz not null default now()
);

create index wins_awarded_date_idx on public.wins (awarded_date);

alter table public.wins enable row level security;
create policy "owner_full_access" on public.wins
  for all using (public.is_owner()) with check (public.is_owner());

create or replace function public.create_win_on_award()
returns trigger
language plpgsql
as $$
declare
  v_client_name text;
  v_total_value numeric;
  v_margin_percent numeric;
begin
  if new.status = 'awarded' and (old.status is distinct from 'awarded') then
    select name into v_client_name from public.clients where id = new.client_id;

    select q.total_amount, q.blended_margin_percent
      into v_total_value, v_margin_percent
      from public.quotations q
      where q.rfq_id = new.id
      order by q.created_at desc
      limit 1;

    insert into public.wins (rfq_id, client_name, rfq_reference, awarded_date, total_value, margin_percent)
    values (
      new.id,
      coalesce(v_client_name, 'Unknown client'),
      new.rfq_number,
      current_date,
      v_total_value,
      v_margin_percent
    );
  end if;
  return new;
end;
$$;

create trigger trg_create_win_on_award
  after update on public.rfqs
  for each row execute function public.create_win_on_award();

-- ---------------------------------------------------------------------
-- OKR tracker — session 1 scaffolded `okrs` with a nested key_results
-- jsonb shape that was never built out. This session's spec is a flat
-- single-counter-per-OKR model, so extend rather than replace: `objective`
-- doubles as the title (no UI ever used it, safe to keep the name), and
-- key_results/status/progress stay unused but harmless for now.
-- ---------------------------------------------------------------------
alter table public.okrs
  add column target_number numeric,
  add column current_count numeric not null default 0,
  add column unit_label text;

insert into public.okrs (objective, target_number, current_count, unit_label, quarter)
select 'Legacy clients outreach', 5, 0, 'clients', null
where not exists (select 1 from public.okrs where objective = 'Legacy clients outreach');

insert into public.okrs (objective, target_number, current_count, unit_label, quarter)
select 'New market outreach', 3, 0, 'markets', null
where not exists (select 1 from public.okrs where objective = 'New market outreach');

insert into public.okrs (objective, target_number, current_count, unit_label, quarter)
select 'SEO articles', 50, 41, 'articles', null
where not exists (select 1 from public.okrs where objective = 'SEO articles');

insert into public.okrs (objective, target_number, current_count, unit_label, quarter)
select 'Customer outreach Q2', 20, 0, 'customers', 'Q2'
where not exists (select 1 from public.okrs where objective = 'Customer outreach Q2');

-- ---------------------------------------------------------------------
-- Brewing — replaces the localStorage-only panel from session 1 with a
-- real table so it's shared across devices and the homepage panel can
-- read it live.
-- ---------------------------------------------------------------------
create table public.brewing_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Internal' check (category in ('Internal', 'Growth', 'BD', 'Admin')),
  status text not null default 'Idea' check (status in ('Active', 'Planning', 'Draft', 'Scheduled', 'Idea')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.brewing_items
  for each row execute function public.set_updated_at();

alter table public.brewing_items enable row level security;
create policy "owner_full_access" on public.brewing_items
  for all using (public.is_owner()) with check (public.is_owner());
