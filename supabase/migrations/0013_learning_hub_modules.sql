-- Daily AI-generated learning modules (generate-learning-module Edge Function).
create table if not exists public.learning_hub_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users default auth.uid(),
  generated_date date not null,
  book_title text not null,
  book_author text not null,
  book_source text,
  category text not null,
  description text,
  quote text not null,
  quote_author text,
  key_concepts jsonb not null default '[]'::jsonb,
  key_takeaway text not null,
  application text not null,
  cover_color text default '#3b82f6',
  cover_initial text,
  logged_today boolean default false,
  created_at timestamptz default now()
);

create unique index if not exists learning_hub_modules_date_user
  on public.learning_hub_modules (generated_date, user_id);

-- Owner-only, like every other table (public.is_owner() checks the JWT email).
-- "auth.uid() is not null" would admit any account that signs up.
alter table public.learning_hub_modules enable row level security;
drop policy if exists "owner_all" on public.learning_hub_modules;
create policy "owner_all" on public.learning_hub_modules
  for all using (public.is_owner()) with check (public.is_owner());
