-- CRM companies: one company directory shared by Contacts (People), Pipeline
-- deals, Planning projects and Crosshairs. crosshairs_targets is migrated into
-- it but NOT dropped, so this can be rolled back.
-- RLS uses public.is_owner() like the rest of the schema, not auth.uid() is not null.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trading_name text,
  types text[] default '{}',
  industry text,
  website text,
  address text,
  tin text,
  account_tier text check (account_tier in ('A','B','C')),
  relationship_owner text default 'Khalil Joseph Banares',
  first_engagement_date date,
  notes text,
  known_products text,
  known_clients text,
  known_pricing text,
  strengths text,
  weaknesses text,
  crosshairs_active boolean default false,
  priority text check (priority in ('Hot','Medium','Low','Nurturing')),
  last_touchpoint_date date,
  next_suggested_action text,
  estimated_deal_value numeric,
  current_stage text,
  status text default 'active' check (status in ('active','inactive','blacklisted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Not in the original spec: ON CONFLICT (name) below needs a unique constraint.
  constraint companies_name_key unique (name)
);

drop trigger if exists set_updated_at on public.companies;
create trigger set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
drop policy if exists "owner_all" on public.companies;
create policy "owner_all" on public.companies
  for all using (public.is_owner()) with check (public.is_owner());

-- Links from the rest of the app.
alter table public.contacts add column if not exists company_id uuid references public.companies(id);
alter table public.contacts add column if not exists contact_type text default 'Decision Maker';
alter table public.contacts add column if not exists relationship_strength text default 'Secondary';
alter table public.deals add column if not exists company_id uuid references public.companies(id);
alter table public.projects add column if not exists company_id uuid references public.companies(id);

create index if not exists contacts_company_id_idx on public.contacts (company_id);
create index if not exists deals_company_id_idx on public.deals (company_id);
create index if not exists projects_company_id_idx on public.projects (company_id);

create table if not exists public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  -- on delete set null (spec had no action): deleting a person keeps the log entry.
  contact_id uuid references public.contacts(id) on delete set null,
  interaction_type text check (interaction_type in ('call','email','visit','whatsapp','meeting','other')),
  note text not null,
  interaction_date timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists contact_interactions_company_idx on public.contact_interactions (company_id, interaction_date desc);

alter table public.contact_interactions enable row level security;
drop policy if exists "owner_all" on public.contact_interactions;
create policy "owner_all" on public.contact_interactions
  for all using (public.is_owner()) with check (public.is_owner());

-- Touchpoints now hang off a company. target_id stays (old rows, rollback) but
-- is no longer required.
alter table public.crosshairs_touchpoints add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.crosshairs_touchpoints alter column target_id drop not null;
create index if not exists crosshairs_touchpoints_company_id_idx on public.crosshairs_touchpoints (company_id);

-- crosshairs_targets -> companies. The target's id is reused as the company id so
-- touchpoint history and the cached daily rotation (daily_logs.crosshairs_rotation)
-- keep pointing at the same row. DISTINCT ON guards against two targets sharing a
-- name, which ON CONFLICT cannot handle inside one statement.
insert into public.companies
  (id, name, industry, priority, last_touchpoint_date, next_suggested_action,
   estimated_deal_value, current_stage, notes, crosshairs_active, types)
select distinct on (target_name)
  id,
  target_name,
  industry,
  priority,
  last_touchpoint_date,
  next_suggested_action,
  estimated_value,
  current_stage,
  -- companies has no primary-contact column, so keep that detail in the notes.
  nullif(concat_ws(E'\n', notes, 'Primary contact: ' || nullif(primary_contact_name, '')), ''),
  true,
  array['Prospect']
from public.crosshairs_targets
order by target_name, updated_at desc
on conflict (name) do update set
  industry = coalesce(public.companies.industry, excluded.industry),
  priority = excluded.priority,
  last_touchpoint_date = coalesce(excluded.last_touchpoint_date, public.companies.last_touchpoint_date),
  next_suggested_action = coalesce(excluded.next_suggested_action, public.companies.next_suggested_action),
  estimated_deal_value = coalesce(excluded.estimated_deal_value, public.companies.estimated_deal_value),
  current_stage = coalesce(excluded.current_stage, public.companies.current_stage),
  notes = coalesce(public.companies.notes, excluded.notes),
  crosshairs_active = true,
  types = (select array(select distinct unnest(public.companies.types || array['Prospect'])));

-- Point each old touchpoint at its company (by name, covering the conflict case).
update public.crosshairs_touchpoints t
set company_id = c.id
from public.crosshairs_targets ct
join public.companies c on c.name = ct.target_name
where t.target_id = ct.id and t.company_id is null;

-- Link what already exists by exact (case-insensitive) name. Nothing is created here.
update public.contacts ct
set company_id = c.id
from public.companies c
where ct.company_id is null and lower(trim(ct.company)) = lower(c.name);

update public.deals d
set company_id = c.id
from public.companies c
where d.company_id is null and lower(trim(d.client_name)) = lower(c.name);

update public.projects p
set company_id = c.id
from public.companies c
where p.company_id is null and lower(trim(p.client_name)) = lower(c.name);
