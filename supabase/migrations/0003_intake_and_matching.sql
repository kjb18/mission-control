-- Intake staging queue (paste / upload / webhook all land here for review
-- before anything is written to rfqs/rfq_lines) and fuzzy part matching.

create extension if not exists pg_trgm;

create table public.intake_queue (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('paste', 'upload', 'webhook')),
  raw_input text,
  parsed jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index intake_queue_status_idx on public.intake_queue (status);

create trigger set_updated_at before update on public.intake_queue
  for each row execute function public.set_updated_at();

alter table public.intake_queue enable row level security;

-- Owner can read/update/delete everything.
create policy "owner_full_access" on public.intake_queue
  for all using (public.is_owner()) with check (public.is_owner());

-- The /api/intake webhook (Cloudflare Pages Function, called by the iOS
-- Shortcut) authenticates with a shared secret it checks itself, then
-- writes with the public anon key — it has no Supabase user session, so it
-- is evaluated as the `anon` role here. This policy only ever allows an
-- INSERT with source='webhook'; the owner-only policy above still governs
-- every read/update/delete, so a leaked anon key can add junk queue rows
-- at worst, never read or touch real business data.
create policy "webhook_can_insert" on public.intake_queue
  for insert to anon
  with check (source = 'webhook');

-- Trigram index so part_signatures can be matched by fuzzy description
-- similarity (see parse-rfq Edge Function) instead of exact text.
create index part_signatures_description_trgm_idx
  on public.part_signatures using gin (description gin_trgm_ops);

-- Fuzzy part-signature lookup used by the parse-rfq Edge Function.
-- SECURITY DEFINER-free: the Edge Function calls this with the service role
-- key, which already bypasses RLS, so this stays a plain stable function.
create or replace function public.match_part_signatures(
  search_text text,
  match_limit int default 3,
  min_similarity real default 0.25
)
returns table (
  id uuid,
  part_number text,
  description text,
  manufacturer text,
  unit text,
  similarity real
)
language plpgsql
stable
as $$
begin
  -- Scoped to this transaction only — never leaks to other connections.
  perform set_config('pg_trgm.similarity_threshold', min_similarity::text, true);
  return query
    select ps.id, ps.part_number, ps.description, ps.manufacturer, ps.unit,
           similarity(ps.description, search_text) as similarity
    from public.part_signatures ps
    where ps.description % search_text
    order by similarity(ps.description, search_text) desc
    limit match_limit;
end;
$$;
