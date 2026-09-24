# Mission Control

Operations command center for **Ultra Power Industrial Resources, Inc.** A
single-user Progressive Web App built with React, Vite, Tailwind CSS,
Supabase, ClickUp, and Google Calendar.

## Stack

- React 18 + Vite
- Tailwind CSS
- Supabase (Postgres, Auth, RLS)
- ClickUp API (backlog tasks)
- Google Calendar API (read-sync)
- `vite-plugin-pwa` (installable, offline-capable PWA)
- React Router

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

### Environment variables

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_OWNER_EMAIL` | The single authorized login email (magic link) |
| `VITE_CLICKUP_API_KEY` | ClickUp personal API token, used to read/write tasks in the Admin folder |
| `VITE_GOOGLE_API_KEY` | Google API key, used to read events from the calendar below |
| `VITE_GOOGLE_CALENDAR_ID` | Google Calendar ID to sync (e.g. a Gmail address) |

### ⚠️ Security note on client-side API keys

This is a static PWA with no backend — every `VITE_*` variable is bundled
into the public JS and shipped to the browser. That's the intended,
industry-standard design for `VITE_SUPABASE_ANON_KEY` (it's meant to be
public; Supabase's row-level security is what actually protects data).

It is **not** the standard model for `VITE_CLICKUP_API_KEY` or
`VITE_GOOGLE_API_KEY`. Those tokens are embedded in the deployed bundle in
plain text — anyone who knows the site's URL can extract them from
DevTools/view-source, without ever signing in, since the Supabase
magic-link gate only protects the app's *data*, not the static files
Cloudflare Pages serves. The ClickUp personal token in particular grants
full read/write access to the whole ClickUp workspace, not just the Admin
folder.

This is acceptable for a private, unlisted URL used by a single owner, but
it's a real exposure if the URL is ever shared or discovered. To close it
properly in a future session: proxy both APIs through a small backend
(e.g. a Cloudflare Pages Function) that holds the real keys server-side and
the client calls instead of ClickUp/Google directly.

### Database migrations

Run, in order, in the Supabase SQL Editor (Project → SQL Editor → New
query → paste → Run):

1. `supabase/migrations/0001_init.sql` — creates all 14 tables (`clients`,
   `contacts`, `suppliers`, `part_signatures`, `rfqs`, `rfq_lines`,
   `supplier_quotes`, `quotations`, `purchase_orders`, `deliveries`,
   `invoices`, `daily_logs`, `habits`, `okrs`), their foreign keys, indexes
   on every `closing_date`/`status` column, `updated_at` triggers, and
   row-level security policies for single-owner access.
2. `supabase/migrations/0002_update_owner_email.sql` — corrects the
   `is_owner()` RLS function to `khalil@ultrapowerindustrialinc.com` (the
   real login email; session 1 used the wrong domain). Update it there
   again if the login email ever changes.

## Authentication

Magic-link email via Supabase Auth, locked to
`khalil@ultrapowerindustrialinc.com`. Sessions persist in `localStorage`
(`persistSession: true`), so signing in on one device keeps you signed in
there — and the same link/session model works across devices, since
Supabase issues its own JWT per device on sign-in.

## Daily check-in gate

Every day, before the homepage is usable, Mission Control asks for an
energy level, a one-word feeling, and a gratitude note. Completion is
stored in `daily_logs` (one row per `log_date`). A green dot appears in the
top bar once the day's check-in is complete — tap it any time to redo it.

## ClickUp backlog

The **Backlog** panel (Growth Layer) mirrors open tasks from the ClickUp
**Admin** folder (`90169022938` in workspace `90161542297`) across all its
lists. Each task shows its name, due date, and days since last activity
(ClickUp's `date_updated`); anything ≥14 days stale gets a red counter.
Tasks are draggable onto **Today's Time Blocks** in the Focus Engine — on
drop, Mission Control schedules the block at the next free half-hour,
updates the task's ClickUp due date to match, and attempts a Google
Calendar push (see below).

## Google Calendar sync

**Read** is fully wired: events from `VITE_GOOGLE_CALENDAR_ID` are pulled
into the Weekly Plan (as read-only blocks at their real time, plus a
per-day dot) and the Month Calendar (dot per day), color-coded:

| Source | Color |
| --- | --- |
| RFQ closing date | amber |
| Delivery date | green |
| Invoice closing date | blue |
| Google Calendar meeting | purple |

**Push is intentionally disabled** (`CALENDAR_PUSH_ENABLED = false` in
`src/lib/googleCalendar.js`). Creating/writing Calendar events requires
Google OAuth 2.0 user consent — a plain API key can only *read* public
calendar data, never insert events. The push function is fully written and
called wherever a block is created (weekly plan slot, or a ClickUp task
drag-drop); it currently short-circuits and returns a clear "read-sync
only" status instead of failing with a 401. To enable it: create an OAuth
Client ID in Google Cloud Console, add a consent flow (e.g. Google
Identity Services), and flip the flag once a valid access token is
available.

**Also note:** reading events requires the calendar's sharing setting to
allow it. `khalil.banares@gmail.com`'s calendar currently returns 404 to
the API key — in Google Calendar → Settings → that calendar → **Access
permissions for events**, enable "Make available to public" (or switch to
a domain/service-account model later) for the pull-sync to return data.

## Project structure

```
src/
  lib/            Supabase client, auth/check-in context, ClickUp, Google
                  Calendar, pipeline-events, and other hooks
  components/     Sidebar, TopBar, Layout, CheckInGate, LoginScreen, icons
  pages/
    Home.jsx      Composes the five homepage zones
    home/         Weekly Plan, Focus Engine (incl. Backlog drop target),
                  Business Pulse, Growth Layer (incl. ClickUp Backlog),
                  Month Calendar
    PlaceholderPage.jsx   Scaffolded routes for future sessions
supabase/
  migrations/0001_init.sql
  migrations/0002_update_owner_email.sql
```

## Deploying (Cloudflare Pages)

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

Add these environment variables in the Cloudflare Pages project settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OWNER_EMAIL`
- `VITE_CLICKUP_API_KEY`
- `VITE_GOOGLE_API_KEY`
- `VITE_GOOGLE_CALENDAR_ID`

In Supabase, add the deployed Cloudflare Pages URL to **Auth → URL
Configuration → Redirect URLs** so magic-link emails redirect back
correctly.
