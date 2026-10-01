-- Google Calendar refresh token (authorization-code flow). Kept out of
-- app_settings, which the browser can read: RLS is on and there are no
-- policies, so only Edge Functions using the service role can touch it.
-- app_settings.google_calendar_token still holds the short-lived
-- access_token, expiry and status the app displays.
create table if not exists public.google_oauth_tokens (
  id boolean primary key default true,
  refresh_token text not null,
  client_id text not null,
  scope text,
  updated_at timestamptz not null default now(),
  constraint google_oauth_tokens_singleton check (id)
);

alter table public.google_oauth_tokens enable row level security;
