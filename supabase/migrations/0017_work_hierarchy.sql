-- Four-level work hierarchy: areas → projects → missions → work_items.
-- Used by the Planning page and the task properties panel.
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text default '#3b82f6',
  icon text default '□',
  description text,
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references public.areas(id),
  name text not null,
  status text default 'active',
  description text,
  due_date date,
  created_at timestamptz default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  area_id uuid references public.areas(id),
  name text not null,
  status text default 'open',
  priority text default 'Medium',
  due_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.missions(id),
  project_id uuid references public.projects(id),
  area_id uuid references public.areas(id),
  title text not null,
  status text default 'open',
  priority text default 'Medium',
  due_date date,
  notes text,
  type text default 'task',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace trigger set_updated_at before update on public.work_items
  for each row execute function public.set_updated_at();

-- Owner-only, like every other table (public.is_owner() checks the JWT
-- email). "auth.uid() is not null" would admit any account that signs up.
do $$
declare t text;
begin
  foreach t in array array['areas', 'projects', 'missions', 'work_items'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "owner_all" on public.%I;', t);
    execute format(
      'create policy "owner_all" on public.%I for all using (public.is_owner()) with check (public.is_owner());', t
    );
  end loop;
end $$;

insert into public.areas (name, color, icon) values
  ('Sales', '#3b82f6', '💼'),
  ('Sourcing', '#f59e0b', '🔍'),
  ('Marketing', '#8b5cf6', '📣'),
  ('Finance', '#10b981', '💰'),
  ('Systems', '#6366f1', '⚙️'),
  ('Personal', '#ec4899', '🌱')
on conflict (name) do nothing;
