-- Correct the single-owner email used by RLS policies.
-- Session 1 used khalil@ultrapowerindustrialresources.com by mistake;
-- the real owner login is khalil@ultrapowerindustrialinc.com.

create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = 'khalil@ultrapowerindustrialinc.com',
    false
  );
$$;
