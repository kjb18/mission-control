-- Topic requests for the next generated learning module. The Edge Function
-- uses the newest unused request, then marks it used.
create table if not exists public.learning_hub_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users default auth.uid(),
  request_text text not null,
  requested_date date not null default (now() at time zone 'Asia/Manila')::date,
  used boolean default false,
  created_at timestamptz default now()
);

alter table public.learning_hub_requests enable row level security;
drop policy if exists "owner_all" on public.learning_hub_requests;
create policy "owner_all" on public.learning_hub_requests
  for all using (public.is_owner()) with check (public.is_owner());
