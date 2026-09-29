-- Homepage Time Blocks: today's blocks as [{ "time": "HH:mm", "label": "…" }],
-- written by src/pages/Home.jsx and upserted on log_date.
alter table daily_logs add column if not exists time_blocks jsonb default '[]'::jsonb;
