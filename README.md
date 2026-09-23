# Mission Control

Operations command center for **Ultra Power Industrial Resources, Inc.** A
single-user Progressive Web App built with React, Vite, Tailwind CSS, and
Supabase.

## Stack

- React 18 + Vite
- Tailwind CSS
- Supabase (Postgres, Auth, RLS)
- `vite-plugin-pwa` (installable, offline-capable PWA)
- React Router

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

### Environment variables

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_OWNER_EMAIL` | The single authorized login email (magic link) |

### Database migration

Run `supabase/migrations/0001_init.sql` in the Supabase SQL Editor
(Project → SQL Editor → New query → paste → Run). It creates all 14 tables
(`clients`, `contacts`, `suppliers`, `part_signatures`, `rfqs`, `rfq_lines`,
`supplier_quotes`, `quotations`, `purchase_orders`, `deliveries`, `invoices`,
`daily_logs`, `habits`, `okrs`), their foreign keys, indexes on every
`closing_date`/`status` column, `updated_at` triggers, and row-level security
policies restricting all access to the single owner email
(`khalil@ultrapowerindustrialresources.com`, set in the `is_owner()`
function at the top of the migration — update it there if the login email
ever changes).

## Authentication

Magic-link email via Supabase Auth, locked to a single owner email. Sessions
persist in `localStorage` (`persistSession: true`), so signing in on one
device keeps you signed in there — and the same link/session model works
across devices, since Supabase issues its own JWT per device on sign-in.

## Daily check-in gate

Every day, before the homepage is usable, Mission Control asks for an
energy level, a one-word feeling, and a gratitude note. Completion is
stored in `daily_logs` (one row per `log_date`). A green dot appears in the
top bar once the day's check-in is complete — tap it any time to redo it.

## Project structure

```
src/
  lib/            Supabase client, auth context, check-in context, hooks
  components/     Sidebar, TopBar, Layout, CheckInGate, LoginScreen, icons
  pages/
    Home.jsx      Composes the five homepage zones
    home/         Weekly Plan, Focus Engine, Business Pulse, Growth Layer, Month Calendar
    PlaceholderPage.jsx   Scaffolded routes for future sessions
supabase/
  migrations/0001_init.sql
```

## Deploying (Cloudflare Pages)

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

Add the same environment variables (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_OWNER_EMAIL`) in the Cloudflare Pages
project settings. In Supabase, add the deployed Cloudflare Pages URL to
**Auth → URL Configuration → Redirect URLs** so magic-link emails redirect
back correctly.
