-- Optional time of day for a task's due date (Asia/Manila wall-clock time).
-- With a due_time set, saving the task from the properties panel also creates
-- a Google Calendar event with a 30-minute popup reminder.
alter table work_items add column if not exists due_time time;
