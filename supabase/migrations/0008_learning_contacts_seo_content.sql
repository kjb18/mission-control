-- Learning Hub, Contacts CRM fields, SEO tracker, Content Calendar.

-- ---------------------------------------------------------------------
-- Contacts: extend the existing table (client_id stays, for the
-- Quote Builder / send-invoice "who do we email this to" lookups) with
-- the flat CRM fields this session's Contacts page needs. A contact
-- doesn't have to be linked to a client row at all now.
-- ---------------------------------------------------------------------
alter table public.contacts
  add column company text,
  add column tag text not null default 'Client' check (tag in ('Client', 'Supplier')),
  add column last_contact_date date;

create index contacts_tag_idx on public.contacts (tag);

-- ---------------------------------------------------------------------
-- Learning Hub
-- ---------------------------------------------------------------------
create table public.learning_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  description text,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  current_streak integer not null default 0,
  last_session_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_topics_status_idx on public.learning_topics (status);

create trigger set_updated_at before update on public.learning_topics
  for each row execute function public.set_updated_at();

alter table public.learning_topics enable row level security;
create policy "owner_full_access" on public.learning_topics
  for all using (public.is_owner()) with check (public.is_owner());

insert into public.learning_topics (title, category, status)
select 'Legal fundamentals', 'Legal', 'active'
where not exists (select 1 from public.learning_topics where title = 'Legal fundamentals');

insert into public.learning_topics (title, category, status)
select 'B2B sales frameworks', 'Sales', 'active'
where not exists (select 1 from public.learning_topics where title = 'B2B sales frameworks');

insert into public.learning_topics (title, category, status)
select 'Philippine power sector', 'Industry', 'active'
where not exists (select 1 from public.learning_topics where title = 'Philippine power sector');

-- ---------------------------------------------------------------------
-- SEO tracker
-- ---------------------------------------------------------------------
create table public.seo_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_keyword text,
  status text not null default 'Draft' check (status in ('Draft', 'Published', 'Scheduled')),
  publish_date date,
  word_count integer,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index seo_articles_status_idx on public.seo_articles (status);
create index seo_articles_publish_date_idx on public.seo_articles (publish_date);

create trigger set_updated_at before update on public.seo_articles
  for each row execute function public.set_updated_at();

alter table public.seo_articles enable row level security;
create policy "owner_full_access" on public.seo_articles
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- Content Calendar
-- ---------------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text not null default 'Website' check (platform in ('Website', 'LinkedIn', 'Instagram', 'Email')),
  status text not null default 'Draft' check (status in ('Draft', 'Scheduled', 'Published')),
  scheduled_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_items_scheduled_date_idx on public.content_items (scheduled_date);

create trigger set_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

alter table public.content_items enable row level security;
create policy "owner_full_access" on public.content_items
  for all using (public.is_owner()) with check (public.is_owner());
