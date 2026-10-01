-- Google Calendar OAuth token saved from Settings so every device can read
-- the calendar: { access_token, expiry } (expiry in epoch milliseconds).
alter table public.app_settings add column if not exists google_calendar_token jsonb;
