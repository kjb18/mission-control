-- daily_logs was readable and writable with only the public anon key on the
-- live project (a permissive policy or RLS switched off outside these
-- migrations). Restore the single-owner rule every other table uses: drop
-- whatever policies exist and recreate owner_full_access.
alter table public.daily_logs enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'daily_logs'
  loop
    execute format('drop policy %I on public.daily_logs;', p.policyname);
  end loop;
end $$;

create policy "owner_full_access" on public.daily_logs
  for all using (public.is_owner()) with check (public.is_owner());
