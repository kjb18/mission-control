-- Homepage Hitlist tasks added from the New Task bar: [{ id, text, done, createdAt }].
alter table public.daily_logs add column if not exists tasks jsonb default '[]'::jsonb;
