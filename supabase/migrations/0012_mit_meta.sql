-- Homepage task properties panel: per-slot MIT properties,
-- { "1": { status, due_date, priority, notes, area, project, mission, type }, "2": …, "3": … }.
alter table daily_logs add column if not exists mit_meta jsonb default '{}'::jsonb;
