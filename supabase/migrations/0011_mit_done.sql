-- Homepage MIT cross-out: double-clicking a MIT marks its slot done.
alter table daily_logs
  add column if not exists mit_1_done boolean default false,
  add column if not exists mit_2_done boolean default false,
  add column if not exists mit_3_done boolean default false;
