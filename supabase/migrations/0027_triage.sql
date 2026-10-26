-- RFQ Triage: incoming RFQs (Gmail agent or manual) wait in triage_queue for an
-- accept / decline decision before they become Pipeline work.
-- RLS uses public.is_owner() like the rest of the schema, not auth.uid() is not null.

-- deals.status has no check constraint (0024), so 'triage_pending' needs no
-- constraint change. Triage deals have no rfq yet: the Pipeline board reads
-- rfqs, so they never appear on it.
alter table public.deals add column if not exists triage_verdict text;
alter table public.deals add column if not exists triage_reason text;
alter table public.deals add column if not exists triage_date timestamptz;
alter table public.deals add column if not exists triage_source text default 'manual';
alter table public.deals add column if not exists triage_override boolean default false;

create table if not exists public.triage_queue (
  id uuid primary key default gen_random_uuid(),
  gmail_thread_id text unique,
  gmail_message_id text,
  from_email text,
  from_name text,
  subject text,
  received_at timestamptz,
  raw_body text,
  rfq_number text,
  client_name text,
  items_detected jsonb default '[]'::jsonb,
  closing_date date,
  claude_verdict text check (claude_verdict in ('go','go_with_clarification','decline')),
  claude_reason text,
  claude_confidence integer,
  status text default 'pending' check (status in ('pending','accepted','declined','duplicate')),
  deal_id uuid references public.deals(id),
  processed_at timestamptz,
  -- Not in the original spec: the page's "Auto-detected" stat and the Override
  -- button need these on the queue row itself. Default is the agent, since the
  -- manual form always sets 'manual' explicitly.
  triage_source text default 'gmail_agent',
  triage_override boolean default false,
  created_at timestamptz default now()
);

create index if not exists triage_queue_status_idx on public.triage_queue (status);

alter table public.triage_queue enable row level security;

drop policy if exists "owner_all" on public.triage_queue;
create policy "owner_all" on public.triage_queue
  for all using (public.is_owner()) with check (public.is_owner());
