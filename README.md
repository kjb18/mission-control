# Mission Control

Operations command center for **Ultra Power Industrial Resources, Inc.** A
single-user Progressive Web App built with React, Vite, Tailwind CSS,
Supabase, ClickUp, Google Calendar, and Claude.

## Stack

- React 18 + Vite
- Tailwind CSS
- Supabase (Postgres, Auth, RLS, Edge Functions)
- ClickUp API (backlog tasks, RFQ sourcing tasks)
- Google Calendar API (OAuth read/write sync)
- Anthropic Claude (RFQ parsing, via a Supabase Edge Function)
- Brevo (transactional invoice emails, via a Supabase Edge Function)
- Cloudflare Pages Functions (iOS Shortcut webhook)
- `vite-plugin-pwa` (installable, offline-capable PWA)
- React Router

## Design system

Mission Control uses a dense, dark "ops center" visual language — every
color, spacing, and type value below is a literal Tailwind token, not an
approximation, so any surface can be built or reviewed against this table
directly.

**Color tokens** (`tailwind.config.js`):

| Token | Hex | Usage |
|---|---|---|
| `bg-base-950` | `#0f1117` | App background |
| `bg-base-900` | `#161b27` | Cards / panels |
| `bg-base-800` | `#1c2333` | Elevated surfaces, inputs, secondary buttons |
| `bg-sidebar` | `#0d1120` | Sidebar, topbar, mobile bottom nav |
| `text-accent` / `bg-accent` | `#f59e0b` | Primary amber accent |
| `hover:bg-accent-light` | `#d97706` | Accent hover state |
| `text-blue-500` | `#3b82f6` | Blue highlight |
| `#1e3a5f` | — | Blue-subtle (active time-block row bg) |
| `text-success` | `#10b981` | Success (== `emerald-500`) |
| `text-danger` | `#ef4444` | Danger (== `red-500`) |
| `text-warning` | `#f97316` | Warning (== `orange-500`) |
| `text-white` | `#f1f5f9` | Text primary (Tailwind's `white` is overridden app-wide) |
| `text-ink-secondary` | `#94a3b8` | Text secondary |
| `text-ink-muted` | `#475569` | Text muted |
| `border-line` | `#1e2d3d` | Default hairline border |
| `border-line-strong` | `#2d3f55` | Strong border |

Every non-palette hue that used to appear in the app (sky, violet, rose,
amber-as-status) has been collapsed onto this table — amber is reserved for
brand accent, status/warning use `orange` (the `warning` token) instead.

**Typography**: system font stack (SF Pro on macOS/iOS —
`-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Helvetica
Neue, sans-serif`), 13px/1.5 body, headings weight 500, section labels
9–11px uppercase with wide letter-spacing, KPI/count numbers use
`.tabular-nums`.

**Reusable component classes** (`src/index.css`, `@layer components`):
`.mc-section-label` (amber eyebrow + trailing rule), `.mc-card`,
`.mc-panel-header`, `.mc-badge`, `.mc-btn-primary`, `.mc-btn-secondary`,
`.input`. Most surfaces still compose the same look from raw Tailwind
utilities (`rounded-lg border-[0.5px] border-line bg-base-900 px-3
py-2.5`) rather than the class — both are the same design, applied
directly for pages built before the `.mc-*` classes existed.

**Layout**: sidebar fixed at 156px (`bg-sidebar`, 2px amber left-border on
the active nav item), topbar fixed at 44px. Below 768px the sidebar
collapses to a fixed icon-only bottom nav (`MobileBottomNav.jsx` — Home,
Pipeline, Sourcing, Ledger, plus a "More" button that opens the full nav
list as an overlay) and all grids stack to a single column.

**Logo**: an amber crosshair mark (`LogoMark` in `src/components/icons.jsx`)
appears in the sidebar header, the topbar (mobile), and the login screen;
the same mark is baked into the PWA icon/splash-screen source SVGs
(`public/icon-source.svg`, `public/icon-maskable-source.svg`).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

### Client (Vite) environment variables

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_OWNER_EMAIL` | The single authorized login email (magic link) — not a secret, just used for an early friendly-reject in the login form; the real enforcement is server-side (`is_owner()` RLS + every Edge Function's `requireOwner()`) |
| `VITE_GOOGLE_CALENDAR_ID` | Google Calendar ID to sync — an identifier, not a credential, and required client-side for the OAuth-authenticated calendar calls, which correctly run directly from the browser (see below) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID — public by design in OAuth flows, powers the Settings → Connect Google Calendar flow |

**Never client variables** — see Security notes below:
- `VITE_CLICKUP_API_KEY` — **removed in the security hardening session**; now `CLICKUP_API_KEY`, a Supabase secret used only by `clickup-proxy`
- `VITE_GOOGLE_API_KEY` — **removed in the security hardening session**; now `GOOGLE_API_KEY`, a Supabase secret used only by `google-calendar-proxy`
- `VITE_GOOGLE_CLIENT_SECRET` / any Google client secret
- `VITE_ANTHROPIC_API_KEY` / any Anthropic key
- `VITE_BREVO_API_KEY` / any Brevo key

### ⚠️ Security notes

**Every Edge Function now requires a real authenticated session — this
closed a genuine pre-existing gap, not a hypothetical one.** Supabase's
platform-level "verify JWT" (on by default for every deployed function)
only checks that the `Authorization` header carries a token *validly
signed* by the project's JWT secret. The public anon key — meant to be
public, already embedded in the client bundle — is itself such a token.
That check alone does not mean the caller is logged in. Proof this was a
real gap, not theoretical: every curl test used to verify `parse-rfq`,
`render-quotation`, and `send-invoice` in sessions 3, 5, and 6 used *only*
the anon key with no real login, and all three worked. `_shared/auth.ts`'s
`requireOwner()` closes it — it calls `auth.getUser()` on the bearer
token (which only succeeds for a genuine session) and checks the email
matches the single owner, the same check `is_owner()` makes at the
database layer — and every function (the three above, plus the two new
proxies below) now calls it before doing anything else, returning a real
`401 {"error":"Unauthorized"}` otherwise. Verified live this session: all
five functions return 401 to an anon-key-only request.

**ClickUp and Google API keys — moved to Edge Function proxies.**
`VITE_CLICKUP_API_KEY` and `VITE_GOOGLE_API_KEY` used to ship in the
public JS bundle — extractable from DevTools by anyone who knew the
site's URL, without ever signing in, since the magic-link gate only
protects app *data*, not the static files Cloudflare serves (the ClickUp
token in particular granted full read/write access to the whole
workspace). Both are gone from the client now. `clickup-proxy` holds
`CLICKUP_API_KEY` and forwards `{method, path, body}` to
`api.clickup.com` — `path` is restricted to `/folder/`, `/list/`, or
`/task/` (the only endpoints this app uses) as defense in depth.
`google-calendar-proxy` holds `GOOGLE_API_KEY` and replaces only the
*fallback* read path used when Calendar isn't connected via OAuth — the
OAuth read/write path (`src/lib/googleAuth.js`) correctly stays
client-side, since the user's own short-lived access token, obtained live
via Google Identity Services, is the right client-side credential there;
unlike a static build-time key, it isn't a secret to protect.

```bash
supabase secrets set CLICKUP_API_KEY=pk_...
supabase secrets set GOOGLE_API_KEY=AIza...
```

**Google OAuth Client Secret — was never in this repo, in any prior
session; this session's premise that it needed "moving" didn't match
reality, so nothing needed fixing here** — flagging that clearly rather
than silently no-op'ing it. A client secret authenticates a
*confidential* client (a server that can keep it secret) during the
Authorization Code exchange; Mission Control has no server for the OAuth
flow, so putting the secret in a `VITE_` variable would ship it to every
visitor's browser in plain text — that isn't "a bit exposed," it defeats
the entire concept of a secret. Google's own guidance for browser apps is
the token-client (implicit-style) flow used here — it exchanges the
Client ID and the page's origin for an access token directly, no secret
involved. It's now stored as the Supabase secret `GOOGLE_CLIENT_SECRET`
per this session's instructions, but nothing reads it — it's there only
in case a future session adds a real server-side Authorization Code flow
(background/offline sync with no user present), which is the only
scenario where it would ever legitimately get used.

```bash
supabase secrets set GOOGLE_CLIENT_SECRET=GOCSPX-...
```

**Anthropic and Brevo API keys — already correctly server-side since the
sessions that introduced them** (parse-rfq / send-invoice respectively);
no change needed here, included for completeness of this session's audit:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set BREVO_API_KEY=xkeysib-...
```

**`VITE_GOOGLE_CALENDAR_ID` — a minor, accepted privacy note, not a
vulnerability:** it's a Gmail address, needed client-side because the
OAuth-authenticated calendar calls run directly from the browser using
the user's own token, so the calendar ID travels with them either way.
Knowing this address doesn't grant access to anything — every credential
that could act on it (the OAuth token, the proxy's API key) stays
properly protected — so this was left as-is rather than "fixed" for its
own sake.

**Google Calendar OAuth requires one manual Console step:** in [Google
Cloud Console](https://console.cloud.google.com) → APIs & Services →
Credentials → this OAuth Client ID → **Authorized JavaScript origins**,
add `http://localhost:5173` (dev) and your Cloudflare Pages URL (prod).
Without this, `Connect Google Calendar` in Settings will fail.

### Database migrations

Run, in order, in the Supabase SQL Editor (Project → SQL Editor → New
query → paste → Run):

1. `0001_init.sql` — all 14 core tables, FKs, `closing_date`/`status`
   indexes, `updated_at` triggers, single-owner RLS.
2. `0002_update_owner_email.sql` — corrects `is_owner()` to
   `khalil@ultrapowerindustrialinc.com`.
3. `0003_intake_and_matching.sql` — `intake_queue` staging table (RLS:
   owner full access, plus an `anon`-insert-only policy scoped to
   `source='webhook'` for the Cloudflare Function), `pg_trgm` extension +
   trigram index on `part_signatures.description`, and the
   `match_part_signatures()` fuzzy-matching RPC used by `parse-rfq`.
4. `0004_sourcing_desk.sql` — `rfq_lines.winning_supplier_quote_id`,
   `supplier_quotes.brand`/`certified`, `suppliers.is_blacklisted`
   (pre-populated: KHM Megatools, Goldpeak Tools), and a one-time backfill
   of any RFQ still at the old `open` status to `intake_confirmed` so
   nothing already in the pipeline goes missing from the Sourcing Desk.
5. `0005_quote_builder_and_pipeline.sql` — singleton `app_settings` table
   (FX rate, editable from Settings), extra `quotations` columns
   (`subtotal`, `vat_amount`, `blended_margin_percent`, `fx_rate_used`,
   `pdf_url`, `line_items`) to snapshot every computed value at send time,
   the private `quotations` storage bucket, and enabling Postgres
   Realtime on `rfqs` (the Pipeline board's live updates).
6. `0006_delivery_and_po_receipt.sql` — `deliveries.delivery_note_number`/
   `photo_path`/`items_delivered`, `purchase_orders.po_document_path`, an
   index on `invoices.due_date` (the Ledger's primary sort/filter column),
   and the private `deliveries`/`purchase-orders` storage buckets — these
   two, unlike `quotations`, get real storage RLS policies (owner-only)
   since the owner uploads to them directly from the browser rather than
   through a service-role Edge Function.
7. `0007_crosshairs_wins_okrs_brewing.sql` — `crosshairs_targets` +
   `crosshairs_touchpoints` tables, `daily_logs.crosshairs_rotation`
   (today's rotation cache), the `wins` table plus a Postgres trigger on
   `rfqs` that inserts a win the moment `status` becomes `'awarded'` —
   from any code path, including a manual Pipeline drag — pulling total
   value/margin from that RFQ's latest `quotations` row, new flat-model
   columns on `okrs` (`target_number`, `current_count`, `unit_label` —
   session 1's `objective`/`key_results` shape was scaffolded but never
   built on, so this extends rather than replaces it) pre-populated with
   the four seed OKRs, and the `brewing_items` table (replacing session
   1's localStorage-only Brewing panel).
8. `0008_learning_contacts_seo_content.sql` — `contacts.company`/`tag`/
   `last_contact_date` (a contact no longer needs a `client_id` link at
   all), `learning_topics` (pre-populated: Legal fundamentals, B2B sales
   frameworks, Philippine power sector), `seo_articles`, and
   `content_items`.

### RFQ status lifecycle

`intake_confirmed` (Intake confirm) → `sourcing` (first supplier quote
logged/selected on the Sourcing Desk) → `sourced` (every line sourced) →
`quoted` (Quote Builder send) → `awarded` (PO receipt form, Quoted
column) → `delivered` (Confirm Delivery form, Awarded column — the only
step in the lifecycle now automated end-to-end, including creating the
invoice). Every transition can also still be done manually by dragging a
card, which is the only way to move `awarded`/`delivered` if the PO or
delivery forms aren't used — and a manual drag into `awarded` still fires
the wins trigger exactly the same as the PO receipt form does. `sourcing`
was introduced in session 5 so the Pipeline board has five columns that
each mean something distinct. The Sourcing Desk and Business Pulse's
"RFQs Unanswered" both account for it.

### Deploying the Edge Functions

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli), logged
in and linked to this project. `supabase/functions/_shared/auth.ts` (the
`requireOwner()` check every function uses) is bundled automatically
whenever any function importing it is deployed — nothing extra to run for
it specifically.

```bash
supabase functions deploy parse-rfq
supabase functions deploy render-quotation
supabase functions deploy send-invoice
supabase functions deploy clickup-proxy
supabase functions deploy google-calendar-proxy
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set BREVO_API_KEY=xkeysib-...
supabase secrets set CLICKUP_API_KEY=pk_...
supabase secrets set GOOGLE_API_KEY=AIza...
supabase secrets set GOOGLE_CLIENT_SECRET=GOCSPX-...
```

### Cloudflare Pages Function environment variables

`functions/api/intake.js` receives the iOS Shortcut webhook. Set these in
Cloudflare Pages → Settings → **Environment variables** (a different list
from the client `VITE_*` build variables above — these stay server-side
and are never bundled into the browser JS):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` |
| `INTAKE_WEBHOOK_SECRET` | A random token (one was generated this session — see the handoff message); the iOS Shortcut sends it as the `x-intake-secret` header |

## Authentication

Magic-link email via Supabase Auth, locked to
`khalil@ultrapowerindustrialinc.com`. Sessions persist in `localStorage`
(`persistSession: true`) across devices.

## Daily check-in gate

Energy level, one-word feeling, and gratitude, stored in `daily_logs`
(one row per day). Green topbar dot once complete; tap it to redo.

## ClickUp backlog

The **Backlog** panel (Growth Layer) mirrors open tasks from the ClickUp
**Admin** folder across all its lists — name, due date, and days since
last activity (ClickUp's `date_updated`), with a red counter at ≥14 days
stale. Draggable onto **Today's Time Blocks**: on drop, Mission Control
schedules the block at the next free half-hour, updates the ClickUp due
date, and pushes a Google Calendar event (if connected). All ClickUp
calls go through `clickup-proxy` (`src/lib/clickup.js`) — the API key
lives only in that function's secret, never in the browser.

## Google Calendar sync (OAuth)

Connect via **Settings → Connect Google Calendar** (Google Identity
Services token-client flow, Client-ID-only — see Security notes). Once
connected:

- **Read** uses your OAuth token, which works for **private** calendars
  (fixing the earlier API-key limitation, which only worked for calendars
  shared publicly). When not connected, falls back to `google-calendar-proxy`
  (the API key lives only in that function's secret now, never in the
  browser) — still public-calendar-only, same limitation, just no longer
  a client-side key to protect. Events populate the Weekly Plan (read-only
  blocks at their real time + a per-day dot) and Month Calendar (dot per day).
- **Write**: creating or editing a time block (Weekly Plan slot, the
  Focus Engine's manual Add form, or a ClickUp drag-drop) pushes a Google
  Calendar event with a 5-minute popup reminder. Editing an
  already-pushed block **updates** the same Google event rather than
  creating a duplicate.
- Dot/event colors: RFQ closing date amber, delivery date green, invoice
  closing date blue, Google Calendar meeting purple, RFQ-closing events
  created by Intake confirmation amber (`colorId: "6"`, Tangerine — the
  closest match in Google's fixed palette, which has no literal "amber").

If not connected, pushes are skipped with a clear status message instead
of failing; nothing is ever silently lost — the block still saves locally.

## Intake (paste / upload / webhook → Claude → review → confirm)

Three ways to start an RFQ, all converging on the same reviewable staging
step before anything is written to `rfqs`/`rfq_lines`:

1. **Paste email text** — sent straight to the `parse-rfq` Edge Function.
2. **Upload PDF or image** — sent to the same function as a base64
   `document`/`image` content block; Claude reads it directly (no OCR
   step needed).
3. **iOS Shortcut webhook** (`POST /api/intake`, header `x-intake-secret`)
   — the Shortcut does its own parsing and posts JSON directly; Mission
   Control stages it in `intake_queue` (status `pending`) rather than
   Claude re-parsing it. Review a pending item from the **iOS Shortcut
   Webhook** tab in Intake — that step runs `parse-rfq` in `match_only`
   mode, which does the part-signature lookup but skips Claude entirely.

`parse-rfq`'s system prompt is exactly as specified: it extracts client
name, RFQ reference, closing date, and line items. The literal instruction
to "check each description against part_signatures" is real, just not
performed by Claude itself (a single Messages API call has no database
access) — the Edge Function does that check as a concrete second step
after Claude responds, via `match_part_signatures()` (Postgres trigram
similarity) plus a `supplier_quotes`/`suppliers` join for pricing and
supplier history. Matches ≥50% similarity are pre-selected in the review
UI; every field and every match choice is editable before confirming.

**On confirm:** writes `rfqs` + `rfq_lines` (resolving/creating the client
by name), then best-effort (non-fatal if either fails — the RFQ is already
saved) creates a ClickUp task *"Source and quote [reference] — closes
[date]"* in the **Ultra Power CRM** list (`src/lib/clickup.js` →
`CLICKUP_RFQ_TASK_LIST_ID` — change that constant to redirect it; no list
was specified, so this was the closest semantic fit among the Admin
folder's lists) and an amber Google Calendar event on the closing date.

## Sourcing Desk (`/sourcing`)

Works one RFQ, one line item, at a time. Only RFQs at status
`intake_confirmed` appear in the picker (Intake confirmation sets this
status now; RFQs are handed off to Quote Builder once every line is
sourced — see below).

**Supplier comparison grid**, per line: supplier, brand, unit price (PHP),
lead time (weeks), certified (yes/no), and landed cost —
`unit price × 57.80 FX × 1.12 (12% freight & duties)`. **Select** sets that
`rfq_line.status = 'sourced'` and records `winning_supplier_quote_id`.

**Supplier outreach**: pick or type a supplier, **Draft Outreach Email**
calls `parse-rfq` in a third mode (`draft_outreach`) that requests price
and lead time for the line item. The "must not mention client name, RFQ
reference, or closing date" requirement is enforced structurally, not just
by prompting — the Edge Function call for this mode never receives those
fields in the first place, so there's nothing for Claude to leak. Shown as
an editable draft; **Open in Email (mailto)** hands it to your default
mail app (Gmail OAuth send isn't connected yet).

**Blacklist guard**: before drafting, the typed/selected supplier name is
checked live against `suppliers.is_blacklisted` (case-insensitive, fresh
query every time — never a cached flag). A match blocks the draft with a
visible warning instead of calling Claude at all.

**Price history**: for each line, resolves the matching `part_signature`
(reusing its existing match if Intake already linked one, else the same
trigram RPC as `parse-rfq`) and shows the last three `supplier_quotes`
against it across any RFQ — supplier, price, lead time, and won/lost/
pending relative to that historical line's `winning_supplier_quote_id`.

**Log a Supplier Reply**: manual entry (supplier, brand, unit price, lead
time in weeks, certified) for replies that come in outside the app —
resolves or creates the supplier by name and writes straight to
`supplier_quotes`, refreshing the grid immediately.

**Auto-advance**: once every line on the open RFQ is `sourced`, its status
flips to `sourced` and a **Proceed to Quote Builder** button appears.

## Quote Builder (`/quote-builder`)

Loads RFQs at status `sourced`. Per line: **landed cost** = winning
supplier's unit price × FX rate × 1.12 (12% freight & duties) — same
formula as the Sourcing Desk, now both reading the same live rate from
`app_settings` instead of each hardcoding it. **Sell price** = landed
cost × (1 + markup%), markup defaulting to 25% and adjustable per line;
**margin%** = (sell − landed) / sell. Totals: subtotal (Σ line totals),
VAT at 12%, grand total, and a quantity-weighted blended margin.

**PDF preview**: **Generate PDF Preview** calls `render-quotation` with
exactly the numbers on screen and renders the result inline (an
`<iframe>` over the signed Storage URL, plus a direct open/download
link). Changing any markup after generating marks the preview stale and
disables approval until it's regenerated — what's approved is always
what was actually rendered.

**Send flow**: requires the approval checkbox. Fetches the client's
primary contact (`contacts` table, `is_primary` preferred) for the
cover email (subject `Quotation — [RFQ reference] — [client name]`) —
a static professional template, deliberately not Claude-generated like
the Sourcing outreach draft, since a client-facing quotation email
should never risk the model inventing pricing details that could drift
from the actual PDF. Sent via `mailto:` (same real limitation as
outreach: **no attachments** — the UI says so and links the downloadable
PDF). On send: writes an immutable `quotations` record (every computed
value, plus a `line_items` snapshot) and flips the RFQ to `quoted`.

## Pipeline Board (`/pipeline`)

Five columns — Intake, Sourcing, Quoted, Awarded, Delivered — one per
RFQ status (see lifecycle above). Each card: client name, RFQ reference,
closing date, line count (`rfq_lines(count)`), and a left-border urgency
color computed from `closing_date` versus now: **red** ≤24h (including
already overdue), **amber** ≤72h, **green** otherwise, neutral if no
closing date.

Cards move two ways: automatically, via a Postgres Realtime subscription
on `rfqs` — any status change from Intake, Sourcing Desk, Quote Builder,
or the two forms below (in this tab, another tab, or another device)
refetches the board with no manual refresh — and manually, by dragging a
card to another column, which just updates `rfqs.status` directly.

**Quoted column — Receive PO:** PO number, date, amount, and an optional
PO document (PDF or image) uploaded to the private `purchase-orders`
bucket. Resolves the RFQ's most recent `quotations` row (the actual link
a PO traces back to an RFQ — `purchase_orders` has no `rfq_id` column of
its own) to set `quotation_id`, creates the `purchase_orders` record, and
flips the RFQ to `awarded`.

**Awarded column — Confirm Delivery:** delivery date, delivery note
number, an items-delivered list pre-filled from the RFQ's `rfq_lines`
(quantities editable — see the migration note on why `rfq_lines` and not
a "PO lines" table), and an optional delivery-note photo uploaded to the
private `deliveries` bucket. On confirm: writes the `deliveries` record,
flips the PO and RFQ to `delivered`, creates the `invoices` record (net
30 terms, invoice number derived from the PO number), and calls
`send-invoice` (best-effort/non-fatal — the delivery and invoice are
already saved either way; a failed email surfaces in the UI so it can be
sent manually).

## Ledger (`/ledger`)

Receivables ageing over `invoices` joined to `clients`. Ageing status is
computed, not stored: `paid` (status or `paid_date` set), else `overdue`
if `due_date` has passed, else `current` — "days overdue" is negative
when the invoice isn't due yet, per spec. A summary row totals
outstanding and overdue amounts and counts overdue invoices; overdue rows
get a red highlight. **Mark as Paid** sets `status='paid'` and stamps
`paid_date`.

## Crosshairs (`/crosshairs`)

Target accounts: name, industry, priority (Hot/Medium/Low/Nurturing),
estimated value, primary contact, stage, last touchpoint, next suggested
action, notes. Cards sort by priority tier, then by last touchpoint
ascending — never-touched sorts as most urgent within its tier — so the
most neglected Hot targets lead. **Log Touchpoint** writes to
`crosshairs_touchpoints` (the full history) and bumps
`crosshairs_targets.last_touchpoint_date` in the same call. Full
create/edit/delete via a form modal.

**Daily rotation** (`src/lib/crosshairs.js` → `fetchTodaysRotatedTarget`):
computed once per day and cached on `daily_logs.crosshairs_rotation` so
it holds steady for the rest of the day even if a touchpoint gets logged
in the meantime. Priority order: any Hot target untouched for ≥2 days
(most neglected first) wins outright; otherwise a Medium target, cycling
to the next one every 2 calendar days; otherwise a Low/Nurturing target,
cycling weekly. The homepage Crosshairs panel shows this pick pinned at
the top, with the rest of the priority-sorted list underneath.

## Wins (`/wins`)

Fully automatic — no manual entry. A Postgres trigger on `rfqs`
(`create_win_on_award`, migration 0007) fires the instant `status`
becomes `'awarded'`, regardless of what set it (the PO receipt form or a
manual Pipeline drag), and inserts a `wins` row pulling `total_value`/
`margin_percent` from that RFQ's most recent `quotations` record. The
page lists wins reverse-chronological with total count and this year's
count/value; the homepage panel shows the 4 most recent plus the
year summary.

## OKRs (`/okrs`)

Flat counter model — title, target number, current count, unit label,
quarter — editable inline (current count) with a progress bar
(`min(100, current/target × 100)`), plus a form to add new OKRs for
future quarters. Pre-populated: Legacy clients outreach (5), New market
outreach (3), SEO articles (50, currently 41), Customer outreach Q2 (20).
The homepage panel mirrors the same live data or progress bars, capped
to the first four.

## Brewing (`/brewing`)

Name, category (Internal/Growth/BD/Admin), status (Active/Planning/
Draft/Scheduled/Idea — changeable inline via the card's own status
select), notes. Now a real table (`brewing_items`), replacing session 1's
localStorage-only version so it's shared across devices; the homepage
panel shows the 6 most recent plus a quick-add box, linking to `/brewing`
for full management.

## Learning Hub (`/learning-hub`)

Topics: title, category, description, progress %, current streak, last
session date, status (active/paused/completed). **Log Session** applies a
real streak rule — consecutive calendar day → streak+1, same day again →
unchanged, any gap → resets to 1 — and lets you update progress % for
that session (no formula for *how much* a session should move progress
was specified, so this is direct input rather than a guessed
auto-increment). Pre-populated: Legal fundamentals, B2B sales frameworks,
Philippine power sector.

The homepage Focus Engine card picks the active topic needing today's
session most — there's no `priority` field on the table, so "highest
priority" is implemented as: not yet logged today first, then the
biggest streak to protect. **Continue** deep-links to
`/learning-hub?topic=<id>&log=1`, which opens straight into Log Session
for that topic. Once logged today, the card collapses to a single line
(name, streak, green dot) — verified live in both states.

## Contacts (`/contacts`)

Full name, company, role, email, phone, tag (Client/Supplier), last
contact date, notes — `contacts.client_id` (used by Quote Builder/
send-invoice to find who to email) is now optional, exposed in the form
as "Link to Client" for contacts that should be discoverable by those
flows. Searchable (name/company/email), sortable by column header, and
filterable by tag. **Send Email** opens a `mailto:` prefilled with the
row's address.

## SEO Tracker (`/seo`)

Article title, target keyword, status (Draft/Scheduled/Published),
publish date, word count, URL — sortable by status or publish date. The
top counter ("X of 50 published") reads its target from the "SEO
articles" OKR rather than hardcoding 50, and every create/update/delete
here recomputes that OKR's `current_count` to the live published count —
genuinely kept in sync, not just visually similar. (The OKR's
pre-populated 41 was a rough historical figure entered in session 7,
before this tracker existed — expect the two to diverge until real
articles are logged here.)

## Content Calendar (`/content`)

Title, platform (Website/LinkedIn/Instagram/Email), status (Draft/
Scheduled/Published), scheduled date. Month grid; click any date to
create an item pre-filled with that date, or click an existing item to
edit it.

## Settings (`/settings`)

Four sections: **Account** (signed-in owner email), **Pricing** (FX rate,
`app_settings`, default 57.80), **Google Calendar** (connection status +
Connect/Disconnect), **Supplier Blacklist** (add by name — resolves an
existing supplier or creates one; remove clears the flag rather than
deleting the supplier record).

## Project structure

```
src/
  lib/            Supabase client, auth/check-in context, ClickUp,
                  Google Calendar + OAuth, pipeline-events, parse-rfq
                  client, RFQ confirmation orchestration, sourcing data
                  access (incl. blacklist manager), price history,
                  outreach, quote builder computation, PDF rendering
                  client, pipeline/realtime, app settings, ledger,
                  purchase orders, delivery, send-invoice client,
                  crosshairs (+ rotation), wins, okrs, brewing, learning
                  hub (+ streak logic), contacts, seo, content, other hooks
  components/     Sidebar, TopBar, Layout, CheckInGate, LoginScreen,
                  Modal, icons
  pages/
    Home.jsx      Composes the five homepage zones
    home/         Weekly Plan, Focus Engine (incl. Backlog drop target,
                  compact Learning Hub card), Business Pulse, Growth
                  Layer (Crosshairs/Backlog/Brewing/Wins/OKRs panels),
                  Month Calendar
    Intake.jsx    Paste/upload/webhook intake + review + confirm
    Sourcing.jsx  Sourcing Desk (comparison grid, outreach, price
                  history, manual quote entry) + sourcing/ sub-components
    QuoteBuilder.jsx  Line pricing, PDF preview/approval, send
                  + quoteBuilder/ sub-components
    Pipeline.jsx  Five-column Kanban with realtime + drag-and-drop
                  + pipeline/ (PO receipt + delivery confirmation modals)
    Ledger.jsx    Receivables ageing table
    Crosshairs.jsx  Target cards, create/edit, log touchpoint
                  + crosshairs/ sub-components
    Wins.jsx      Wins log (fully automatic — no manual entry)
    Okrs.jsx      OKR tracker with inline count editing
    Brewing.jsx   Brewing item management
    LearningHub.jsx  Topic cards, log session (streak rule), deep-link
                  from the homepage card + learningHub/ sub-components
    Contacts.jsx  Searchable/sortable/filterable directory
                  + contacts/ sub-components
    Seo.jsx       Article tracker with OKR-synced progress counter
                  + seo/ sub-components
    Content.jsx   Month calendar, click-a-date-to-create
                  + content/ sub-components
    Settings.jsx  Account, Pricing (FX rate), Google Calendar,
                  Supplier Blacklist
supabase/
  migrations/     0001_init, 0002_update_owner_email,
                  0003_intake_and_matching, 0004_sourcing_desk,
                  0005_quote_builder_and_pipeline,
                  0006_delivery_and_po_receipt,
                  0007_crosshairs_wins_okrs_brewing,
                  0008_learning_contacts_seo_content
  functions/
    _shared/auth.ts     requireOwner() — every function below calls this
                  before doing anything else; see Security notes
    parse-rfq/          Claude extraction, part-signature matching,
                  and supplier outreach drafting (three modes)
    render-quotation/   Branded quotation PDF via pdf-lib (not
                  pdfkit — see note below), uploaded to Storage
    send-invoice/       Brevo transactional invoice email
    clickup-proxy/      Forwards to the ClickUp API with CLICKUP_API_KEY
                  injected server-side
    google-calendar-proxy/  Fallback read path (API-key, not OAuth) with
                  GOOGLE_API_KEY injected server-side
functions/
  api/intake.js   Cloudflare Pages Function — iOS Shortcut webhook
```

Every Sidebar route is now a real page — session 8 was the last set of
placeholders (`content`/`seo`/`contacts`/`learning-hub`), so
`PlaceholderPage.jsx` was deleted along with the routing table that
referenced it.

**Library note (`render-quotation`):** built with **pdf-lib**, not
pdfkit as literally named in the task. pdfkit loads its bundled standard
fonts via `fs` reads relative to `__dirname`, which is a well-documented
break point in Deno's npm compatibility layer (Edge Functions run on
Deno, not Node) — pure filesystem-free PDF construction was the actual
goal pdfkit represented, and pdf-lib delivers that (fonts embedded as
data, zero native/fs dependencies) reliably in this runtime, which is
why it's what Supabase's own Edge Function PDF examples use. Puppeteer,
the task's other named option, isn't viable at all here regardless —
Edge Functions have no Chromium binary to launch. Verified with a real
deploy + request: valid PDF, uploaded to Storage, signed URL returned,
layout matches the spec exactly (checked by rendering the actual output).

## Deploying (Cloudflare Pages)

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

### Client (`VITE_*`) build variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OWNER_EMAIL`
- `VITE_GOOGLE_CALENDAR_ID`
- `VITE_GOOGLE_CLIENT_ID`

**Removed from this list in the security hardening session** —
`VITE_CLICKUP_API_KEY` and `VITE_GOOGLE_API_KEY` no longer exist anywhere,
client-side or in Cloudflare. Delete both from the Cloudflare Pages
project's environment variables if they're still set there from an
earlier session.

### Pages Function variables (server-side only, separate from the above)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `INTAKE_WEBHOOK_SECRET`

### Never add to Cloudflare (see Security notes) — all Supabase secrets instead

- `VITE_CLICKUP_API_KEY` — now `CLICKUP_API_KEY`, a Supabase secret (`clickup-proxy`)
- `VITE_GOOGLE_API_KEY` — now `GOOGLE_API_KEY`, a Supabase secret (`google-calendar-proxy`)
- `VITE_GOOGLE_CLIENT_SECRET` — `GOOGLE_CLIENT_SECRET`, a Supabase secret; unused by any code today
- `VITE_ANTHROPIC_API_KEY` — `ANTHROPIC_API_KEY`, a Supabase secret (`parse-rfq`)
- `VITE_BREVO_API_KEY` — `BREVO_API_KEY`, a Supabase secret (`send-invoice`)

In Supabase, add the deployed Cloudflare Pages URL to **Auth → URL
Configuration → Redirect URLs**, and in Google Cloud Console add it to the
OAuth Client's **Authorized JavaScript origins**.
