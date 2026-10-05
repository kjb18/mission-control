import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import homeCss from "./Home.css?raw";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useCheckIn } from "../lib/CheckInContext";
import { fetchAdminBacklogTasks, CLICKUP_WORKSPACE_ID } from "../lib/clickup";
import { createEvent, isGoogleCalendarConfigured } from "../lib/googleCalendar";
import { getAccessToken, adoptAccessToken } from "../lib/googleAuth";
import { fetchTodayModule } from "../lib/learningModules";
import TaskPanel from "../components/TaskPanel";
import WeekTimeGrid, { timeLabel } from "./WeekTimeGrid";
import { createCalendarEvent, pushDueEventIfChanged } from "../lib/calendarEvents";
import { pickFields } from "../lib/taskFields";
import { useHierarchy } from "../lib/hierarchy";

/* =============================================================================
   Self-contained homepage — a direct port of the approved reference artifact
   (https://claude.ai/artifact/WEazPHCVf63UUggMXkSqYK). Home.css is a verbatim
   copy of that file's <style> block. It is imported raw and mounted as a
   <style> tag that lives and dies with this page, because the reference's
   :root / * / body rules would otherwise leak onto every Layout route.
   This page renders its own sidebar and topbar and uses no shared components.
   ============================================================================= */

// ---------------------------------------------------------------------------
// Dates — everything is Asia/Manila wall-clock time.
// ---------------------------------------------------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// Google Calendar reads, always through the google-calendar-proxy Edge
// Function. When Google Calendar is connected (Settings), the proxy reads
// as the owner and refreshes the access token itself; otherwise it falls
// back to its API key, which only sees public calendars. Each response says
// which happened (token_state), which drives the banner / Connect link.
// Raw events are mapped here so their fields can be inspected in DevTools.
// ---------------------------------------------------------------------------
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

// "valid" | "expired" | "none", reported to the page via onCalendarState.
let onCalendarState = () => {};

async function fetchCalendarRaw({ timeMin, timeMax }) {
  const { data, error } = await supabase.functions.invoke("google-calendar-proxy", {
    body: { calendarId: CALENDAR_ID, timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() },
  });
  if (data?.token_state) {
    onCalendarState(data.token_state === "valid" ? "valid" : data.token_state === "refresh_failed" ? "expired" : "none");
  }
  // Lets pushes from this page (createEvent) use the owner's token.
  if (data?.access_token) adoptAccessToken(data.access_token, data.expiry);
  return data ?? { ok: false, error: error?.message ?? "google-calendar-proxy failed" };
}

// Returns [{ title, start }]. title is null when Google sent no name — the
// usual cause is a calendar shared publicly as "free/busy only", which
// strips summaries from API-key reads.
async function fetchCalendarEvents(range) {
  if (!CALENDAR_ID) return [];
  const raw = await fetchCalendarRaw(range);
  console.log("Google Calendar proxy response keys:", Object.keys(raw ?? {}));
  const items =
    [raw?.items, raw?.events, raw?.data?.items].find((a) => Array.isArray(a) && a.length > 0) ?? [];
  if (!items.length && raw?.error) console.warn("[Home] Google Calendar:", raw.error?.message ?? raw.error);
  if (items.length) console.log("Google Calendar event fields:", JSON.stringify(items[0]));
  return items
    .map((ev) => {
      const startRaw = ev.start?.dateTime ?? ev.start?.date;
      const endRaw = ev.end?.dateTime ?? ev.end?.date;
      return {
        title: ev.summary || ev.title || ev.name || null,
        start: startRaw ? new Date(startRaw) : null,
        end: endRaw ? new Date(endRaw) : null,
        allDay: Boolean(ev.start?.date && !ev.start?.dateTime),
      };
    })
    .filter((ev) => ev.start);
}

// Cap the wait on Google so a slow or failing Calendar request can't hold
// back the weekly plan and calendar, which also render Supabase and
// localStorage data.
function fetchCalendarEventsWithTimeout(range, ms = 8000) {
  return Promise.race([
    fetchCalendarEvents(range).catch((err) => {
      console.warn("[Home] Google Calendar:", err.message);
      return [];
    }),
    new Promise((resolve) => setTimeout(() => resolve([]), ms)),
  ]);
}

function getManilaDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}
function toManila(date) {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}
// The reference used toISOString() here, which shifts Manila dates back a
// day before 08:00. Read the wall-clock fields instead.
function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getWeekDates() {
  const d = getManilaDate();
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sun);
    dd.setDate(sun.getDate() + i);
    return dd;
  });
}
function manilaInstant(iso, time = "00:00:00") {
  return new Date(`${iso}T${time}+08:00`);
}
function daysAgo(iso) {
  if (!iso) return null;
  return Math.round((manilaInstant(isoDate(getManilaDate())) - manilaInstant(iso)) / 86400000);
}
function greetingWord() {
  const h = getManilaDate().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function formatPeso(n) {
  if (n == null) return "—";
  if (n >= 1e6) return `₱${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `₱${Math.round(n / 1e3)}K`;
  return `₱${Math.round(n)}`;
}

const UNANSWERED_STATUSES = ["intake_confirmed", "sourced"];
const BRIEF_DATE_KEY = "mc_morning_brief_date";
const BRIEF_TEXT_KEY = "mc_morning_brief_text";
const TASK_DOT_COLOR = "#0d9488";
const pesoFull = (n) =>
  `₱${Number(n ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function dayOfYear(d) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
}
function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

// learning_topics has no cover column today; pick one up if it's ever added.
const COVER_FIELDS = ["cover_image_url", "image_url", "cover_url"];
function topicCoverUrl(topic) {
  if (!topic) return null;
  const key = COVER_FIELDS.find((k) => k in topic) ?? Object.keys(topic).find((k) => /image|cover/i.test(k));
  const url = key ? topic[key] : null;
  return typeof url === "string" && url.trim() ? url : null;
}

// Split on sentence ends: "." or "!" followed by a space or the end of the text.
function sentences(text) {
  return (text ?? "")
    .trim()
    .split(/(?<=[.!])(?:\s+|$)/)
    .map((x) => x.trim())
    .filter(Boolean);
}
const POM_TOTAL = 25 * 60;
const CIRC = 2 * Math.PI * 19;
const LOFI_URL = "https://www.youtube.com/watch?v=jfKfPfyJRdk";
const RITUAL_KEY = "mc_morning_dismissed";
const ZONE_ORDER_KEY = "mc_zone_order";
const WEEKLY_DROPS_KEY = "mc_weekly_drops";
const DEFAULT_ZONE_ORDER = ["pulse", "weekly", "focus", "crosshairs", "hitlist", "brewing", "calendar"];
// These three sit side by side when adjacent; alone they grow to full width.
const THIRD_ZONES = ["crosshairs", "hitlist", "brewing"];
// The weekly plan is frozen in the second slot; only the other zones reorder.
const FIXED_ZONE = "weekly";
const FIXED_ZONE_INDEX = 1;
function withFixedZone(movable) {
  const order = movable.filter((id) => id !== FIXED_ZONE);
  order.splice(FIXED_ZONE_INDEX, 0, FIXED_ZONE);
  return order;
}
const GROWTH_ROWS = 6;

const PRIORITY_RANK = { Hot: 0, Medium: 1, Low: 2, Nurturing: 3 };
const PRIORITY_STYLE = {
  Hot: { dot: "var(--red)", bdg: "bdg-r", label: "Hot" },
  Medium: { dot: "var(--orange)", bdg: "bdg-a", label: "Med" },
  Low: { dot: "var(--t4)", bdg: "bdg-gr", label: "Low" },
  Nurturing: { dot: "var(--purple)", bdg: "bdg-p", label: "Nurturing" },
};
const BREWING_RANK = { Active: 0, Planning: 1, Scheduled: 2, Draft: 3, Idea: 4 };
const BREWING_STYLE = {
  Active: { dot: "var(--blue)", bdg: "bdg-b" },
  Planning: { dot: "var(--purple)", bdg: "bdg-p" },
  Draft: { dot: "var(--t3)", bdg: "bdg-gr" },
  Scheduled: { dot: "var(--green)", bdg: "bdg-g" },
  Idea: { dot: "var(--t4)", bdg: "bdg-gr" },
};

const FEELINGS = ["Focused", "Motivated", "Anxious", "Tired", "Calm", "Scattered", "Confident", "Energised", "Grateful", "Heavy"];
const ENERGY = [
  { emoji: "😔", label: "Depleted" },
  { emoji: "😐", label: "Low" },
  { emoji: "🙂", label: "Steady" },
  { emoji: "😊", label: "Strong" },
  { emoji: "⚡", label: "Peak" },
];
const SHUTDOWN_ITEMS = ["Inbox zero", "Tomorrow's MITs set", "Desk cleared", "Wins logged", "Calendar checked"];

function loadZoneOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(ZONE_ORDER_KEY));
    if (!Array.isArray(saved)) return DEFAULT_ZONE_ORDER;
    // The old combined "growth" zone becomes its three cards, in place.
    const expanded = saved.flatMap((id) => (id === "growth" ? THIRD_ZONES : [id]));
    const valid = [...new Set(expanded)].filter((id) => DEFAULT_ZONE_ORDER.includes(id));
    return withFixedZone([...valid, ...DEFAULT_ZONE_ORDER.filter((id) => !valid.includes(id))]);
  } catch {
    return DEFAULT_ZONE_ORDER;
  }
}

// Weekly plan drops saved while Google Calendar isn't connected:
// { "yyyy-MM-dd": [{ t: "adm", l: "task label" }, …] }
function loadWeeklyDrops() {
  try {
    const saved = JSON.parse(localStorage.getItem(WEEKLY_DROPS_KEY));
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    const drops = {};
    Object.entries(saved).forEach(([ds, items]) => {
      if (!Array.isArray(items)) return;
      // Earlier builds stored plain label strings; read both shapes.
      const chips = items
        .map((item) => (typeof item === "string" ? item : item?.l))
        .filter((l) => typeof l === "string" && l.trim() !== "")
        .map((l) => ({ t: "adm", l, local: true }));
      if (chips.length) drops[ds] = chips;
    });
    return drops;
  } catch {
    return {};
  }
}
// Stored shape is exactly { t: "adm", l } — the in-memory `local` flag stays out.
function writeWeeklyDrops(drops) {
  const clean = {};
  Object.entries(drops).forEach(([ds, chips]) => {
    if (chips.length) clean[ds] = chips.map((c) => ({ t: "adm", l: c.l }));
  });
  try {
    localStorage.setItem(WEEKLY_DROPS_KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable — chip lasts for this session only */
  }
}
function removeWeeklyDrop(label) {
  const drops = loadWeeklyDrops();
  Object.keys(drops).forEach((ds) => {
    drops[ds] = drops[ds].filter((d) => d.l !== label);
  });
  writeWeeklyDrops(drops);
}
function saveWeeklyDrop(ds, label) {
  const drops = loadWeeklyDrops();
  drops[ds] = [...(drops[ds] ?? []), { t: "adm", l: label }];
  writeWeeklyDrops(drops);
}

function ritualDismissed() {
  try {
    return sessionStorage.getItem(RITUAL_KEY) === "1";
  } catch {
    return false;
  }
}

// Returns true when every listed daily_logs column exists. PostgREST rejects
// a select naming an unknown column, so a zero-row head request is a cheap probe.
async function dailyLogsHasColumns(columns) {
  const { error } = await supabase.from("daily_logs").select(columns, { head: true }).limit(1);
  return !error;
}

// ---------------------------------------------------------------------------
// Icons — paths copied from the reference.
// ---------------------------------------------------------------------------
const Icon = ({ children }) => <svg viewBox="0 0 24 24">{children}</svg>;
const ICONS = {
  home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  pipeline: (<><rect x="3" y="3" width="7" height="18" /><rect x="14" y="3" width="7" height="10" /></>),
  pulse: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  search: (<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  file: <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />,
  dollar: (<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></>),
  target: (<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></>),
  trend: <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />,
  clock: (<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  flame: <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />,
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  users: (<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></>),
  book: (<><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93l-1.41 1.41M5.34 17.66l-1.41 1.41M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 18.66l1.41 1.41M2 12h2M20 12h2" /></>),
  list: (<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /></>),
  pin: <path d="M12 2a5 5 0 015 5c0 3.5-5 13-5 13S7 10.5 7 7a5 5 0 015-5z" />,
  grid: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  warn: (<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  sparkle: <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" />,
  compass: (<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>),
};

const NAV = [
  { section: null, items: [{ label: "Home", to: "/", icon: "home" }] },
  {
    section: "Operations",
    items: [
      { label: "Pipeline", to: "/pipeline", icon: "pipeline" },
      { label: "Intake", to: "/intake", icon: "pulse" },
      { label: "Sourcing", to: "/sourcing", icon: "search" },
      { label: "Quote Builder", to: "/quote-builder", icon: "file" },
      { label: "Ledger", to: "/ledger", icon: "dollar" },
    ],
  },
  {
    section: "Growth",
    growth: true,
    items: [
      { label: "Crosshairs", to: "/crosshairs", icon: "target" },
      { label: "Wins", to: "/wins", icon: "trend" },
      { label: "OKRs", to: "/okrs", icon: "clock" },
      { label: "Planning", to: "/planning", icon: "grid" },
      { label: "Brewing", to: "/brewing", icon: "flame" },
      { label: "Content", to: "/content", icon: "calendar" },
      { label: "SEO", to: "/seo", icon: "pulse" },
    ],
  },
  {
    section: "Workspace",
    items: [
      { label: "Contacts", to: "/contacts", icon: "users" },
      { label: "Learning Hub", to: "/learning-hub", icon: "book" },
      { label: "Settings", to: "/settings", icon: "settings" },
    ],
  },
];

function DragHandle({ visible }) {
  return (
    <svg className="drag-handle" viewBox="0 0 24 24" style={{ display: visible ? "flex" : "none" }}>
      <circle cx="9" cy="5" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="19" r="1" fill="currentColor" />
      <circle cx="15" cy="5" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

// Inner drop targets ignore zone drags so the zone reorder owns those.
const isZoneDrag = (e) => e.dataTransfer.types.includes("zone-drag");

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
// Phones only (CSS shows it below 768px, where the sidebar is hidden).
const MOBILE_NAV = [
  { label: "Home", to: "/", icon: "home" },
  { label: "Pipeline", to: "/pipeline", icon: "pipeline" },
  { label: "Crosshairs", to: "/crosshairs", icon: "target" },
  { label: "Learning Hub", to: "/learning-hub", icon: "book" },
  { label: "Settings", to: "/settings", icon: "settings" },
];
function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <nav className="mnav" aria-label="Main">
      {MOBILE_NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <button key={item.to} className={`mnav-i${active ? " on" : ""}`} onClick={() => navigate(item.to)}>
            <svg viewBox="0 0 24 24">{ICONS[item.icon]}</svg>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ fullName, ritualDone }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isActive = (to) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`));

  return (
    <div className="sb">
      <div className="sb-head">
        <div className="sb-logo">
          <div className="sb-icon">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="3" /></svg>
          </div>
          <div className="sb-app">Mission Control</div>
        </div>
        <div className="sb-co">Ultra Power</div>
        <div className="sb-role">Engineering Solutions Director</div>
      </div>
      {NAV.map((group, gi) => (
        <Fragment key={gi}>
          {group.section && <div className="sb-sec">{group.section}</div>}
          {group.items.map((item) => {
            const active = isActive(item.to);
            const cls = active ? (group.growth ? " ap" : " ab") : "";
            return (
              <div key={item.to} className={`sbi${cls}`} onClick={() => navigate(item.to)}>
                <Icon>{ICONS[item.icon]}</Icon>
                {item.label}
              </div>
            );
          })}
        </Fragment>
      ))}
      <div className="sb-foot">
        <div className="sb-user">
          <svg style={{ width: 13, height: 13, stroke: "currentColor", fill: "none", strokeWidth: 2 }} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          {fullName}
        </div>
        <div className="sb-ci">
          <div className="ci-dot"></div>
          <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>{ritualDone ? "Ritual complete" : "Ritual pending"}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Morning ritual
// ---------------------------------------------------------------------------
function MorningRitual({ firstName, mit1, hotTarget, seoOkr, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [feeling, setFeeling] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [gratitude, setGratitude] = useState("");
  const done = step > 5;

  const okrTarget = Number(seoOkr?.target_number ?? 0);
  const okrCurrent = Number(seoOkr?.current_count ?? 0);
  const okrPct = okrTarget ? Math.min(100, Math.round((okrCurrent / okrTarget) * 100)) : 0;
  const lastContact = daysAgo(hotTarget?.last_touchpoint_date);

  return (
    <div className="morning-overlay">
      <div className="morning-modal">
        <div className="mm-head">
          <div className="mm-icon">🌅</div>
          <div className="mm-title">{greetingWord()}, {firstName}.</div>
          <div className="mm-sub">3-minute ritual · Own your day</div>
        </div>
        <div className="mm-body">
          <div className={`mm-step${step === 1 ? " active" : ""}`}>
            <div className="mm-step-label"><span>1</span> How do you feel right now?</div>
            <div className="mm-chips">
              {FEELINGS.map((f) => (
                <span key={f} className={`mm-chip${feeling === f ? " sel" : ""}`} onClick={() => setFeeling(f)}>{f}</span>
              ))}
            </div>
            <div className="mm-note">Naming your emotional state reduces amygdala activation and sharpens focus. Takes 5 seconds.</div>
          </div>
          <div className={`mm-step${step === 2 ? " active" : ""}`}>
            <div className="mm-step-label"><span>2</span> Energy level today</div>
            <div className="mm-energy">
              {ENERGY.map((e, i) => (
                <div key={e.label} className={`mm-e-btn${energy === i ? " sel" : ""}`} onClick={() => setEnergy(i)}>
                  <span className="mm-e-emoji">{e.emoji}</span>
                  <span className="mm-e-label">{e.label}</span>
                </div>
              ))}
            </div>
            <div className="mm-note" style={{ marginTop: 10 }}>High energy: deep work first. Low energy: admin and email first. Honest self-assessment doubles follow-through.</div>
          </div>
          <div className={`mm-step${step === 3 ? " active" : ""}`}>
            <div className="mm-step-label"><span>3</span> One thing you are grateful for</div>
            <textarea className="mm-textarea" rows={3} value={gratitude} onChange={(e) => setGratitude(e.target.value)} placeholder="e.g. Good sleep. Eloissa's support. The PGPC relationship progressing well."></textarea>
            <div className="mm-note" style={{ marginTop: 8 }}>Gratitude reduces cortisol by up to 23% and primes the brain's reward circuits. Takes 20 seconds.</div>
          </div>
          <div className={`mm-step${step === 4 ? " active" : ""}`}>
            <div className="mm-step-label"><span>4</span> Today's implementation intention</div>
            <div className="mm-intention">
              <strong>I will complete:</strong> MIT 1 — {mit1 || "not set yet"}<br />
              <strong>Starting at:</strong> 9:00 AM at my desk<br />
              <strong>If distracted, I will:</strong> close all tabs and return to Mission Control
            </div>
            <div className="mm-note" style={{ marginTop: 8 }}>"I will do X at time Y in place Z" doubles follow-through vs. goal-setting alone. Pre-filled from last night.</div>
          </div>
          <div className={`mm-step${step === 5 ? " active" : ""}`}>
            <div className="mm-step-label"><span>5</span> What matters most this week</div>
            <div className="mm-prime">
              <div className="mm-prime-card">
                <div className="mm-prime-label">Today's Crosshairs target</div>
                <div className="mm-prime-val">{hotTarget?.target_name ?? "No targets yet"}</div>
                <div className="mm-prime-sub">
                  {hotTarget
                    ? [hotTarget.priority, hotTarget.next_suggested_action || hotTarget.current_stage, lastContact == null ? "No contact logged" : `Last contact ${lastContact} day${lastContact === 1 ? "" : "s"} ago`]
                        .filter(Boolean)
                        .join(" · ")
                    : "Add a target in Crosshairs"}
                </div>
              </div>
              <div className="mm-prime-card">
                <div className="mm-prime-label">OKR · SEO articles</div>
                <div className="mm-prime-val">{seoOkr ? `${okrCurrent} of ${okrTarget} published` : "No SEO OKR found"}</div>
                <div className="mm-prime-sub">{seoOkr ? `${okrPct}% complete · ${Math.max(0, okrTarget - okrCurrent)} articles remaining this quarter` : "Add one in OKRs"}</div>
                <div className="mm-bar-bg"><div className="mm-bar-fill" style={{ width: `${okrPct}%` }}></div></div>
              </div>
            </div>
            <div className="mm-note" style={{ marginTop: 8 }}>Visual priming activates neural pathways. Reading your target once makes you 3× more likely to act on it today.</div>
          </div>
          <div className={`mm-step${done ? " active" : ""}`}>
            <div className="mm-done">
              <div className="mm-done-icon">✅</div>
              <div className="mm-done-title">You are ready, {firstName}.</div>
              <div className="mm-done-sub">Mind primed. Intention set.<br />Go execute.</div>
              <button className="mm-unlock" onClick={() => onComplete({ feeling, energy, gratitude })}>Unlock Mission Control</button>
            </div>
          </div>
        </div>
        <div className="mm-foot" style={done ? { display: "none" } : undefined}>
          <div className="mm-dots">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`mm-dot${i <= step ? " on" : ""}`}></div>
            ))}
          </div>
          <button className="mm-skip" onClick={onClose}>Skip for now</button>
          <button className="mm-next" onClick={() => setStep((s) => s + 1)}>Continue →</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task properties — shared by every task surface on the page.
// ---------------------------------------------------------------------------
const TASK_PROPS_KEY = "mc_task_props";
const WEEKLY_DONE_KEY = "mc_weekly_done";
// Tasks due outside the current week: { "yyyy-MM-dd": ["task label", …] }
const CALENDAR_DOTS_KEY = "mc_calendar_dots";
const EMPTY_MIT_STATE = { done: false, meta: {} };

function readJson(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}
// Properties for weekly chips and time blocks, keyed by task label.
const loadTaskProps = (key) => readJson(TASK_PROPS_KEY)[key] ?? {};
function saveTaskProps(key, props, oldKey) {
  const all = readJson(TASK_PROPS_KEY);
  if (oldKey && oldKey !== key) delete all[oldKey];
  all[key] = props;
  writeJson(TASK_PROPS_KEY, all);
}
function deleteTaskProps(key) {
  const all = readJson(TASK_PROPS_KEY);
  delete all[key];
  writeJson(TASK_PROPS_KEY, all);
}

// Single click opens the panel, double click toggles done. The single-click
// action waits briefly so a double click doesn't also open the panel.
// True at phone width (matches the 768px CSS breakpoint).
function useIsMobile() {
  const query = "(max-width: 768px)";
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

function useClickOrDouble() {
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (onSingle, onDouble) => ({
    onClick: (e) => {
      if (e.detail > 1) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(onSingle, 220);
    },
    onDoubleClick: () => {
      clearTimeout(timer.current);
      onDouble();
    },
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const checkIn = useCheckIn();

  const fullName = user?.user_metadata?.full_name || "Khalil J. Banares";
  const firstName = fullName.split(" ")[0];

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const todayISO = isoDate(getManilaDate());

  // ---- Data state -----------------------------------------------------------
  const [pulse, setPulse] = useState({ rfqs: null, pos: null, pending: null, completed: null });
  const [soonestRfq, setSoonestRfq] = useState(null);
  const [weekEvents, setWeekEvents] = useState({});
  const [calMonth, setCalMonth] = useState(() => {
    const d = getManilaDate();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [monthDots, setMonthDots] = useState({});
  const [mits, setMits] = useState([]);
  // Parallel to mits: [{ done, meta }] where meta is the slot's mit_meta entry.
  const [mitState, setMitState] = useState([]);
  const mitsRef = useRef([]);
  const mitStateRef = useRef([]);
  mitsRef.current = mits;
  mitStateRef.current = mitState;
  const [blocks, setBlocks] = useState([]);
  const [weeklyDone, setWeeklyDone] = useState(() => readJson(WEEKLY_DONE_KEY));
  // ClickUp tasks and Mission Control work_items; tasks typed here live in
  // logTasks (daily_logs.tasks).
  const [hitlist, setHitlist] = useState([]);
  const [mcTasks, setMcTasks] = useState([]);
  const [logTasks, setLogTasks] = useState([]);
  const logTasksRef = useRef([]);
  logTasksRef.current = logTasks;
  const [hitlistError, setHitlistError] = useState(null);
  // Hitlist edits made in the panel: { [id]: { done, label, props } }. ClickUp
  // tasks aren't written back, so these live in component state.
  const [hitlistMeta, setHitlistMeta] = useState({});
  const [targets, setTargets] = useState([]);
  const [brewing, setBrewing] = useState([]);
  const [topic, setTopic] = useState(null);
  // Today's generated learning module; null → the card falls back to learning_topics.
  const [learnModule, setLearnModule] = useState(null);
  const [seoOkr, setSeoOkr] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const schema = useRef({ mitColumns: false, timeBlocks: false, mitDone: false, mitMeta: false });
  const savedMitCount = useRef(0);

  const [showRitual, setShowRitual] = useState(() => !ritualDismissed());
  const [ritualDone, setRitualDone] = useState(false);

  // ---- Loaders ----------------------------------------------------------------
  const loadPulse = useCallback(async () => {
    const year = getManilaDate().getFullYear();
    const [rfqs, pos, invoices, completed, soonest] = await Promise.all([
      supabase.from("rfqs").select("id", { count: "exact", head: true }).in("status", UNANSWERED_STATUSES),
      supabase.from("purchase_orders").select("id", { count: "exact", head: true }).neq("status", "delivered"),
      supabase.from("invoices").select("amount").neq("status", "paid"),
      supabase
        .from("rfqs")
        .select("id", { count: "exact", head: true })
        .eq("status", "delivered")
        .gte("created_at", manilaInstant(`${year}-01-01`).toISOString())
        .lt("created_at", manilaInstant(`${year + 1}-01-01`).toISOString()),
      supabase
        .from("rfqs")
        .select("rfq_number, title, closing_date")
        .in("status", UNANSWERED_STATUSES)
        .gte("closing_date", isoDate(getManilaDate()))
        .order("closing_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    [rfqs, pos, invoices, completed, soonest].forEach((r) => r.error && console.warn("[Home] pulse query failed:", r.error.message));
    setPulse({
      rfqs: rfqs.error ? null : rfqs.count ?? 0,
      pos: pos.error ? null : pos.count ?? 0,
      pending: invoices.error ? null : (invoices.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0),
      completed: completed.error ? null : completed.count ?? 0,
    });
    setSoonestRfq(soonest.data ?? null);
  }, []);

  // ---- Auto-rejected quotation alerts (rfq_alerts, raised by the Pipeline page).
  const [rfqAlerts, setRfqAlerts] = useState([]);
  useEffect(() => {
    if (!user) return;
    const dismissedKey = `mc_alerts_dismissed_${isoDate(getManilaDate())}`;
    if (readSession(dismissedKey)) return;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    supabase
      .from("rfq_alerts")
      .select("id, rfq_number")
      .eq("dismissed", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.warn("[Home] rfq_alerts unavailable:", error.message);
        else setRfqAlerts(data ?? []);
      });
  }, [user]);
  const dismissAlerts = async () => {
    const ids = rfqAlerts.map((a) => a.id);
    setRfqAlerts([]);
    writeSession(`mc_alerts_dismissed_${isoDate(getManilaDate())}`, "1");
    const { error } = await supabase.from("rfq_alerts").update({ dismissed: true }).in("id", ids);
    if (error) console.warn("[Home] dismissing alerts failed:", error.message);
  };

  // ---- Google Calendar connection state: "valid" | "expired" | "none".
  const [gcalState, setGcalState] = useState(null);
  useEffect(() => {
    onCalendarState = setGcalState;
    return () => {
      onCalendarState = () => {};
    };
  }, []);

  // ---- AI morning brief: generated once per Manila day, cached in sessionStorage.
  const [aiBrief, setAiBrief] = useState(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const today = isoDate(getManilaDate());
      const cached = readSession(BRIEF_TEXT_KEY);
      if (readSession(BRIEF_DATE_KEY) === today && cached) {
        setAiBrief(cached);
        return;
      }
      const [count, soonest, overdue, xh] = await Promise.all([
        supabase.from("rfqs").select("id", { count: "exact", head: true }).in("status", UNANSWERED_STATUSES),
        supabase
          .from("rfqs")
          .select("rfq_number, title, closing_date")
          .in("status", UNANSWERED_STATUSES)
          .not("closing_date", "is", null)
          .order("closing_date", { ascending: true })
          .limit(1)
          .maybeSingle(),
        // Invoices are stored unpaid/paid — overdue means unpaid and past due
        // (or explicitly marked overdue).
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .or(`status.eq.overdue,and(status.neq.paid,due_date.lt.${today})`),
        supabase.from("crosshairs_targets").select("target_name, priority, next_suggested_action"),
      ]);
      const top = [...(xh.data ?? [])].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9))[0];
      const rfqCount = count.count ?? 0;
      const urgent = soonest.data;
      const data = [
        `Open RFQs: ${rfqCount}.`,
        `Most urgent: ${urgent ? `${urgent.rfq_number || urgent.title} closing ${urgent.closing_date}` : "none"}.`,
        `Overdue invoices: ${overdue.count ?? 0}.`,
        `Top Crosshairs target: ${top ? `${top.target_name} (${top.priority})${top.next_suggested_action ? ` — next: ${top.next_suggested_action}` : ""}` : "none"}.`,
      ].join(" ");
      let text;
      try {
        const { data: res, error } = await supabase.functions.invoke("parse-rfq", { body: { mode: "morning_brief", data } });
        if (error || !res?.summary) throw new Error(error?.message ?? res?.error ?? "no summary");
        text = res.summary;
        writeSession(BRIEF_TEXT_KEY, text);
        writeSession(BRIEF_DATE_KEY, today);
      } catch (e) {
        console.warn("[Home] morning brief unavailable — using the plain summary:", e.message);
        text = `${rfqCount} RFQs need attention.${urgent ? ` Most urgent closes ${urgent.closing_date}.` : ""}`;
      }
      if (!cancelled) setAiBrief(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loadWeek = useCallback(async () => {
    const days = getWeekDates();
    const startISO = isoDate(days[0]);
    const endISO = isoDate(days[6]);
    const [rfqs, deliveries, invoices, cal, logs] = await Promise.all([
      supabase.from("rfqs").select("rfq_number, title, closing_date").gte("closing_date", startISO).lte("closing_date", endISO),
      supabase.from("deliveries").select("delivery_date, purchase_orders(po_number)").gte("delivery_date", startISO).lte("delivery_date", endISO),
      supabase.from("invoices").select("invoice_number, due_date").neq("status", "paid").gte("due_date", startISO).lte("due_date", endISO),
      fetchCalendarEventsWithTimeout({ timeMin: manilaInstant(startISO), timeMax: manilaInstant(endISO, "23:59:59") }),
      supabase.from("daily_logs").select("log_date, time_blocks").gte("log_date", startISO).lte("log_date", endISO),
    ]);
    const map = {};
    const push = (ds, ev) => ds && (map[ds] = [...(map[ds] ?? []), ev]);
    (rfqs.data ?? []).forEach((r) => push(r.closing_date, { t: "rfq", l: `${r.rfq_number || r.title} close` }));
    (deliveries.data ?? []).forEach((d) => push(d.delivery_date, { t: "del", l: d.purchase_orders?.po_number ? `${d.purchase_orders.po_number} delivery` : "Delivery" }));
    (invoices.data ?? []).forEach((i) => push(i.due_date, { t: "adm", l: i.invoice_number ? `${i.invoice_number} due` : "Invoice due" }));
    // Nameless events are skipped rather than shown as "untitled" chips.
    // Timed events carry their start/end so the time grid can place them.
    cal.forEach(
      (ev) =>
        ev.title &&
        push(isoDate(toManila(ev.start)), {
          t: "mtg",
          l: ev.title,
          ...(ev.allDay || !ev.end ? {} : { timed: true, start: ev.start, end: ev.end }),
        })
    );
    // Time blocks scheduled onto a day (daily_logs.time_blocks), unless Google already has that event.
    const have = new Set(cal.filter((ev) => ev.title && ev.start).map((ev) => `${ev.title}|${ev.start.getTime()}`));
    (logs.data ?? []).forEach((row) =>
      (Array.isArray(row.time_blocks) ? row.time_blocks : []).forEach((b) => {
        if (!b?.label || !/^\d{2}:\d{2}/.test(b.time ?? "")) return;
        const start = manilaInstant(row.log_date, `${b.time.slice(0, 5)}:00`);
        if (have.has(`${b.label}|${start.getTime()}`)) return;
        push(row.log_date, { t: "adm", l: b.label, timed: true, block: true, start, end: new Date(start.getTime() + 30 * 60000) });
      })
    );
    const drops = loadWeeklyDrops();
    days.forEach((d) => (drops[isoDate(d)] ?? []).forEach((chip) => push(isoDate(d), chip)));
    setWeekEvents(map);
  }, []);

  const loadMonth = useCallback(async ({ y, m }) => {
    const startISO = `${y}-${pad(m + 1)}-01`;
    const endISO = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
    const [rfqs, deliveries, poDue, invoices, cal] = await Promise.all([
      supabase.from("rfqs").select("closing_date").gte("closing_date", startISO).lte("closing_date", endISO),
      supabase.from("deliveries").select("delivery_date").gte("delivery_date", startISO).lte("delivery_date", endISO),
      supabase.from("purchase_orders").select("expected_delivery_date").neq("status", "delivered").gte("expected_delivery_date", startISO).lte("expected_delivery_date", endISO),
      supabase.from("invoices").select("due_date").gte("due_date", startISO).lte("due_date", endISO),
      fetchCalendarEventsWithTimeout({ timeMin: manilaInstant(startISO), timeMax: manilaInstant(endISO, "23:59:59") }),
    ]);
    const dots = {};
    const add = (ds, c) => {
      if (!ds) return;
      dots[ds] = dots[ds] ?? [];
      if (!dots[ds].includes(c)) dots[ds].push(c);
    };
    (rfqs.data ?? []).forEach((r) => add(r.closing_date, "amber"));
    (deliveries.data ?? []).forEach((d) => add(d.delivery_date, "green"));
    (poDue.data ?? []).forEach((p) => add(p.expected_delivery_date, "green"));
    (invoices.data ?? []).forEach((i) => add(i.due_date, "blue"));
    // A busy block is still a meeting, so month dots keep nameless events.
    cal.forEach((ev) => add(isoDate(toManila(ev.start)), "purple"));
    setMonthDots(dots);
  }, []);

  const loadDailyLog = useCallback(async () => {
    const today = isoDate(getManilaDate());
    const [mitColumns, timeBlocks, mitDone, mitMeta, tasksCol] = await Promise.all([
      dailyLogsHasColumns("mit_1,mit_2,mit_3"),
      dailyLogsHasColumns("time_blocks"),
      dailyLogsHasColumns("mit_1_done,mit_2_done,mit_3_done"),
      dailyLogsHasColumns("mit_meta"),
      dailyLogsHasColumns("tasks"),
    ]);
    schema.current = { mitColumns, timeBlocks, mitDone, mitMeta, tasks: tasksCol };
    if (!mitDone) console.warn("[Home] daily_logs has no mit_N_done columns — MIT cross-outs won't persist until migration 0011 runs.");
    if (!mitMeta) console.warn("[Home] daily_logs has no mit_meta column — MIT properties won't persist until migration 0012 runs.");
    if (!mitColumns) console.warn("[Home] daily_logs has no mit_1/mit_2/mit_3 columns — using the mits jsonb array.");
    if (!timeBlocks) console.warn("[Home] daily_logs has no time_blocks column — time blocks stay in this browser.");

    const response = await supabase.from("daily_logs").select("*").eq("log_date", today).maybeSingle();
    console.log("Loaded MITs from daily_logs:", response);
    const { data: row, error } = response;
    if (error) console.warn("[Home] daily_logs read failed:", error.message);
    const isLabel = (v) => typeof v === "string" && v.trim() !== "";
    const slots = mitColumns
      ? [1, 2, 3].map((n) => ({
          label: row?.[`mit_${n}`],
          state: { done: Boolean(row?.[`mit_${n}_done`]), meta: row?.mit_meta?.[n] ?? {} },
        }))
      : (row?.mits ?? []).map((label) => ({ label, state: EMPTY_MIT_STATE }));
    const loaded = slots.filter((s) => isLabel(s.label)).slice(0, 3);
    savedMitCount.current = loaded.length;
    setMits(loaded.map((s) => s.label));
    setMitState(loaded.map((s) => s.state));
    setLogTasks(
      Array.isArray(row?.tasks) ? row.tasks.filter((t) => t && typeof t.text === "string" && t.text.trim()) : []
    );

    if (timeBlocks) {
      setBlocks(Array.isArray(row?.time_blocks) ? row.time_blocks : []);
    } else {
      try {
        setBlocks(JSON.parse(localStorage.getItem(`mc_time_blocks_${today}`)) ?? []);
      } catch {
        setBlocks([]);
      }
    }
  }, []);

  const loadGrowth = useCallback(async () => {
    const [xh, br, lt, okrs] = await Promise.all([
      supabase.from("crosshairs_targets").select("*"),
      supabase.from("brewing_items").select("*"),
      supabase.from("learning_topics").select("*").eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("okrs").select("*"),
    ]);
    [xh, br, lt, okrs].forEach((r) => r.error && console.warn("[Home] growth query failed:", r.error.message));
    setTargets(
      [...(xh.data ?? [])].sort((a, b) => {
        const d = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        if (d) return d;
        return (a.last_touchpoint_date ?? "").localeCompare(b.last_touchpoint_date ?? "");
      })
    );
    setBrewing([...(br.data ?? [])].sort((a, b) => (BREWING_RANK[a.status] ?? 9) - (BREWING_RANK[b.status] ?? 9)));
    setTopic(lt.data ?? null);
    setSeoOkr((okrs.data ?? []).find((o) => /seo/i.test(o.title ?? o.objective ?? "")) ?? null);
  }, []);

  const loadHitlist = useCallback(async () => {
    const loadClickUp = async () => {
      try {
        const tasks = await fetchAdminBacklogTasks();
        setHitlistError(null);
        setHitlist(tasks.map((t) => ({ id: t.id, label: t.name, age: t.daysSinceActivity ?? 0, source: "clickup" })));
      } catch (e) {
        console.warn("[Home] ClickUp hitlist failed:", e.message);
        setHitlistError(e.message);
      }
    };
    // GET /rest/v1/work_items?status=in.(open,in_progress)&type=eq.task&order=created_at.desc&limit=50
    const loadWorkItems = async () => {
      const { data, error } = await supabase
        .from("work_items")
        .select("id, title, created_at")
        .in("status", ["open", "in_progress"])
        .eq("type", "task")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.warn("[Home] work_items hitlist failed:", error.message);
        return;
      }
      setMcTasks(
        (data ?? []).map((w) => ({
          id: `mc-${w.id}`,
          label: w.title,
          age: Math.max(0, Math.floor((Date.now() - new Date(w.created_at).getTime()) / 86400000)) || 0,
          source: "mc",
        }))
      );
    };
    await Promise.allSettled([loadClickUp(), loadWorkItems()]);
  }, []);

  // Re-fetch both hitlist sources every 5 minutes.
  useEffect(() => {
    const id = setInterval(loadHitlist, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadHitlist]);

  // Areas → projects → missions for the task panel (live tables, migration 0017).
  const { panel: hierarchy, reload: reloadHierarchy } = useHierarchy();

  const loadModule = useCallback(async () => {
    try {
      setLearnModule(await fetchTodayModule());
    } catch (e) {
      console.warn("[Home] generate-learning-module unavailable — using learning_topics:", e.message);
      setLearnModule(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setSyncing(true);
    await Promise.allSettled([loadPulse(), loadWeek(), loadDailyLog(), loadGrowth(), loadHitlist(), reloadHierarchy(), loadModule()]);
    setSyncing(false);
  }, [loadPulse, loadWeek, loadDailyLog, loadGrowth, loadHitlist, reloadHierarchy, loadModule]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadMonth(calMonth);
  }, [calMonth, loadMonth]);

  // ---- Writers ------------------------------------------------------------------
  // next: MIT labels in order. nextState: matching [{ done, meta }]; when
  // omitted, each label keeps the state it already had, so done flags and
  // properties follow a MIT when the list is reordered or compacted.
  const persistMits = useCallback(async (next, nextStateArg) => {
    const byLabel = new Map(mitsRef.current.map((l, i) => [l, mitStateRef.current[i]]));
    const nextState = nextStateArg ?? next.map((l) => byLabel.get(l) ?? EMPTY_MIT_STATE);
    mitsRef.current = next;
    mitStateRef.current = nextState;
    setMits(next);
    setMitState(nextState);
    const today = isoDate(getManilaDate());
    const { mitDone, mitMeta } = schema.current;
    let payload;
    if (schema.current.mitColumns) {
      payload = { log_date: today };
      next.forEach((label, i) => {
        if (!label) return;
        payload[`mit_${i + 1}`] = label;
        if (mitDone) payload[`mit_${i + 1}_done`] = Boolean(nextState[i]?.done);
      });
      // Slots that held a MIT at the last save and are now empty must be
      // cleared explicitly, or a merge upsert leaves the deleted MIT in place.
      for (let i = next.length; i < savedMitCount.current; i++) {
        payload[`mit_${i + 1}`] = null;
        if (mitDone) payload[`mit_${i + 1}_done`] = false;
      }
      if (mitMeta) payload.mit_meta = Object.fromEntries(next.map((_, i) => [i + 1, nextState[i]?.meta ?? {}]));
    } else {
      payload = { log_date: today, mits: next };
    }
    console.log("Saving MITs to daily_logs:", JSON.stringify(payload));
    // Direct PostgREST call so the Prefer header is exactly
    // resolution=merge-duplicates,return=minimal (supabase-js omits return=minimal).
    const { data: auth } = await supabase.auth.getSession();
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/daily_logs?on_conflict=log_date`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${auth.session?.access_token ?? anonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn("[Home] saving MITs to daily_logs failed:", res.status, await res.text());
    else savedMitCount.current = next.length;
  }, []);

  const persistBlocks = useCallback(async (next) => {
    const sorted = [...next].sort((a, b) => a.time.localeCompare(b.time));
    setBlocks(sorted);
    const today = isoDate(getManilaDate());
    if (schema.current.timeBlocks) {
      const { error } = await supabase.from("daily_logs").upsert({ log_date: today, time_blocks: sorted }, { onConflict: "log_date" });
      if (error) console.warn("[Home] saving time blocks failed:", error.message);
    } else {
      try {
        localStorage.setItem(`mc_time_blocks_${today}`, JSON.stringify(sorted));
      } catch {
        /* storage unavailable — state only */
      }
    }
  }, []);

  // Tasks typed on this page: saved as today's daily_logs.tasks
  // [{ id, text, done, createdAt }] (migration 0015).
  const persistLogTasks = useCallback(async (next) => {
    logTasksRef.current = next;
    setLogTasks(next);
    if (!schema.current.tasks) {
      console.warn("[Home] daily_logs has no tasks column — hitlist task kept in local state only.");
      return;
    }
    const { error } = await supabase
      .from("daily_logs")
      .upsert({ log_date: isoDate(getManilaDate()), tasks: next }, { onConflict: "log_date" });
    if (error) console.warn("[Home] saving hitlist tasks to daily_logs failed:", error.message);
  }, []);

  const addToHitlist = useCallback(async (label) => {
    persistLogTasks([
      { id: `local-${Date.now()}`, text: label, done: false, createdAt: new Date().toISOString() },
      ...logTasksRef.current,
    ]);
    const { data: area } = await supabase.from("areas").select("id").eq("name", "Systems").maybeSingle();
    const { error } = await supabase
      .from("work_items")
      .insert({ title: label, type: "task", status: "open", area_id: area?.id ?? null });
    if (error) console.warn("[Home] work_items unavailable — hitlist task kept in local state only:", error.message);
  }, [persistLogTasks]);

  // Hitlist as shown: ClickUp tasks first, then Mission Control work_items
  // (deduped by title, ClickUp wins), each oldest first; today's typed tasks
  // (minus any already present by title) go on top.
  const hitlistView = useMemo(() => {
    const byAge = (a, b) => b.age - a.age;
    const seen = new Set();
    const keep = (t) => {
      const k = t.label.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    };
    const clickup = [...hitlist].sort(byAge).filter(keep);
    const mc = [...mcTasks].sort(byAge).filter(keep);
    const local = logTasks
      .filter((t) => !seen.has(t.text.trim().toLowerCase()))
      .map((t) => ({
        id: t.id,
        label: t.text,
        age: Math.max(0, Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000)) || 0,
        local: true,
      }));
    return [...local, ...clickup, ...mc];
  }, [hitlist, mcTasks, logTasks]);

  // ---- Cross-out (double click) --------------------------------------------------------
  const clickOrDouble = useClickOrDouble();

  const toggleMitDone = (i) => {
    const nextState = mitStateRef.current.map((st, j) =>
      j === i ? { done: !st.done, meta: { ...st.meta, status: !st.done ? "Done" : "Open" } } : st
    );
    persistMits(mitsRef.current, nextState);
  };
  const toggleBlockDone = (i) => persistBlocks(blocks.map((b, j) => (j === i ? { ...b, done: !b.done } : b)));
  const setWeeklyDoneFor = (ds, label, done) => {
    setWeeklyDone((prev) => {
      const day = { ...(prev[ds] ?? {}) };
      if (done) day[label] = true;
      else delete day[label];
      const next = { ...prev, [ds]: day };
      if (!Object.keys(day).length) delete next[ds];
      writeJson(WEEKLY_DONE_KEY, next);
      return next;
    });
  };
  const isWeeklyDone = (ds, label) => Boolean(weeklyDone[ds]?.[label]);

  // ---- Task properties panel ---------------------------------------------------------
  const [panelTask, setPanelTask] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openPanel = (task) => {
    setPanelTask({ uid: `${task.kind}:${Date.now()}`, canDelete: true, ...task });
    setPanelOpen(true);
  };

  const openMitPanel = (i) => {
    const st = mitState[i] ?? EMPTY_MIT_STATE;
    openPanel({
      kind: "mit",
      index: i,
      title: mits[i],
      source: `MIT ${i + 1} · saved to today's daily log`,
      fields: { ...pickFields(st.meta), status: st.meta.status ?? (st.done ? "Done" : "Open") },
    });
  };
  const openWeekPanel = (ds, chip, idx) => {
    const done = isWeeklyDone(ds, chip.l);
    const props = loadTaskProps(chip.l);
    openPanel({
      kind: "week",
      ds,
      idx,
      chip,
      title: chip.l,
      source: `Weekly plan · ${ds}`,
      fields: { ...pickFields(props), status: props.status ?? (done ? "Done" : "Open") },
      canDelete: Boolean(chip.local),
      deleteNote: chip.local ? null : "This chip comes from Supabase or Google Calendar — remove it at its source.",
    });
  };
  const openBlockPanel = (i) => {
    const b = blocks[i];
    const props = loadTaskProps(b.label);
    openPanel({
      kind: "block",
      index: i,
      title: b.label,
      source: `Time block · ${b.time}`,
      fields: { ...pickFields(props), status: props.status ?? (b.done ? "Done" : "Open") },
    });
  };
  const openHitlistPanel = (t) => {
    const meta = hitlistMeta[t.id] ?? {};
    openPanel({
      kind: "hitlist",
      id: t.id,
      local: t.local,
      title: meta.label ?? t.label,
      source: t.local ? "Hitlist · added here" : t.source === "mc" ? "Hitlist · Mission Control task" : "Hitlist · ClickUp task",
      fields: { ...pickFields(meta.props), status: meta.props?.status ?? (meta.done ? "Done" : "Open") },
      canDelete: Boolean(t.local),
      deleteNote: t.local ? null : t.source === "mc" ? "Mission Control tasks are removed in Work Items." : "ClickUp tasks are removed in ClickUp.",
    });
  };
  const openCrosshairsPanel = (t) => {
    const extra = loadTaskProps(`crosshairs:${t.id}`);
    openPanel({
      kind: "crosshairs",
      id: t.id,
      title: t.target_name,
      source: "Crosshairs target",
      fields: { ...pickFields(extra), priority: t.priority, notes: t.notes ?? "" },
      priorityOptions: ["Hot", "Medium", "Low", "Nurturing"],
      confirmDelete: true,
    });
  };
  const openBrewingPanel = (b) => {
    const extra = loadTaskProps(`brewing:${b.id}`);
    openPanel({
      kind: "brewing",
      id: b.id,
      title: b.name,
      source: "Brewing item",
      fields: { ...pickFields(extra), status: b.status, notes: b.notes ?? "" },
      // brewing_items.status is limited to these by a check constraint.
      statusOptions: ["Active", "Planning", "Draft", "Scheduled", "Idea"],
      confirmDelete: true,
    });
  };

  const [calToast, setCalToast] = useState(null);
  const calToastTimer = useRef(null);
  const showCalToast = (msg, ok = true) => {
    setCalToast({ msg, ok });
    clearTimeout(calToastTimer.current);
    calToastTimer.current = setTimeout(() => setCalToast(null), 5000);
  };
  useEffect(() => () => clearTimeout(calToastTimer.current), []);

  const savePanel = async ({ title, fields }) => {
    const t = panelTask;
    const done = fields.status === "Done";
    const { status, notes, priority, ...rest } = fields;
    if (t.kind === "mit") {
      const next = mitsRef.current.map((l, i) => (i === t.index ? title : l));
      const nextState = mitStateRef.current.map((st, i) => (i === t.index ? { done, meta: { ...fields } } : st));
      await persistMits(next, nextState);
    } else if (t.kind === "week") {
      const rename = (l) => (l === t.chip.l ? title : l);
      setWeekEvents((prev) => ({
        ...prev,
        [t.ds]: (prev[t.ds] ?? []).map((c, i) => (i === t.idx ? { ...c, l: title } : c)),
      }));
      if (t.chip.local) {
        const drops = readJson(WEEKLY_DROPS_KEY);
        if (Array.isArray(drops[t.ds])) {
          drops[t.ds] = drops[t.ds].map((d) => (typeof d === "string" ? { t: "adm", l: rename(d) } : { ...d, l: rename(d.l) }));
          writeJson(WEEKLY_DROPS_KEY, drops);
        }
      }
      if (title !== t.chip.l) setWeeklyDoneFor(t.ds, t.chip.l, false);
      setWeeklyDoneFor(t.ds, title, done);
      saveTaskProps(title, fields, t.chip.l);
    } else if (t.kind === "block") {
      const old = blocks[t.index];
      await persistBlocks(blocks.map((b, i) => (i === t.index ? { ...b, label: title, done } : b)));
      saveTaskProps(title, fields, old?.label);
    } else if (t.kind === "hitlist") {
      setHitlistMeta((prev) => ({ ...prev, [t.id]: { label: title, done, props: fields } }));
      if (t.local && title !== t.title) {
        persistLogTasks(logTasksRef.current.map((x) => (x.id === t.id ? { ...x, text: title } : x)));
      }
      // Mirror to work_items: update the row with this task's title, else add one.
      const row = {
        title,
        type: "task",
        status: status.toLowerCase().replace(/ /g, "_"),
        notes: notes || null,
        priority,
        due_date: fields.due_date || null,
        due_time: fields.due_time || null,
        area_id: hierarchy.ids.area(fields.area),
        project_id: hierarchy.ids.project(fields.project),
        mission_id: hierarchy.ids.mission(fields.mission),
      };
      const existing = await supabase.from("work_items").select("id").eq("title", t.title).limit(1).maybeSingle();
      const res = existing.data
        ? await supabase.from("work_items").update(row).eq("id", existing.data.id)
        : await supabase.from("work_items").insert(row);
      if (existing.error || res.error) {
        console.warn("[Home] saving hitlist task to work_items failed:", (existing.error ?? res.error).message);
      }
    } else if (t.kind === "crosshairs") {
      const { error } = await supabase.from("crosshairs_targets").update({ target_name: title, priority, notes: notes || null }).eq("id", t.id);
      if (error) console.warn("[Home] updating crosshairs target failed:", error.message);
      else setTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, target_name: title, priority, notes } : x)));
      saveTaskProps(`crosshairs:${t.id}`, rest);
    } else if (t.kind === "brewing") {
      const { error } = await supabase.from("brewing_items").update({ name: title, status, notes: notes || null }).eq("id", t.id);
      if (error) console.warn("[Home] updating brewing item failed:", error.message);
      else setBrewing((prev) => prev.map((x) => (x.id === t.id ? { ...x, name: title, status, notes } : x)));
      saveTaskProps(`brewing:${t.id}`, { ...rest, priority });
    }
    // Due date → a chip on that day this week, or a blue dot on the month calendar.
    const oldLabel = t.kind === "week" ? t.chip.l : t.kind === "block" ? blocks[t.index]?.label : t.title;
    applyDueDate(title, fields.due_date, oldLabel);
    closePanel();
    // A due date + time also goes on the calendar (30-minute popup alert → iPhone).
    const pushed = await pushDueEventIfChanged({ title, fields, before: { title: t.title, fields: t.fields } });
    if (pushed) showCalToast(pushed.ok ? `Calendar alert set for ${fields.due_date} ${fields.due_time}` : `Calendar alert failed: ${pushed.error}`, pushed.ok);
  };

  const deletePanelTask = async () => {
    const t = panelTask;
    if (t.kind === "mit") {
      persistMits(mitsRef.current.filter((_, i) => i !== t.index));
    } else if (t.kind === "week") {
      setWeekEvents((prev) => ({ ...prev, [t.ds]: (prev[t.ds] ?? []).filter((_, i) => i !== t.idx) }));
      const drops = readJson(WEEKLY_DROPS_KEY);
      if (Array.isArray(drops[t.ds])) {
        const at = drops[t.ds].findIndex((d) => (typeof d === "string" ? d : d?.l) === t.chip.l);
        if (at > -1) drops[t.ds].splice(at, 1);
        if (!drops[t.ds].length) delete drops[t.ds];
        writeJson(WEEKLY_DROPS_KEY, drops);
      }
      setWeeklyDoneFor(t.ds, t.chip.l, false);
      deleteTaskProps(t.chip.l);
    } else if (t.kind === "block") {
      persistBlocks(blocks.filter((_, i) => i !== t.index));
    } else if (t.kind === "hitlist") {
      persistLogTasks(logTasksRef.current.filter((x) => x.id !== t.id));
    } else if (t.kind === "crosshairs") {
      const { error } = await supabase.from("crosshairs_targets").delete().eq("id", t.id);
      if (error) console.warn("[Home] deleting crosshairs target failed:", error.message);
      else setTargets((prev) => prev.filter((x) => x.id !== t.id));
    } else if (t.kind === "brewing") {
      const { error } = await supabase.from("brewing_items").delete().eq("id", t.id);
      if (error) console.warn("[Home] deleting brewing item failed:", error.message);
      else setBrewing((prev) => prev.filter((x) => x.id !== t.id));
    }
    closePanel();
  };

  // ---- Crosshairs daily pick --------------------------------------------------
  // Hot targets rotate by day of year; with no Hot targets, Medium ones do.
  const featuredTarget = useMemo(() => {
    const hot = targets.filter((t) => t.priority === "Hot");
    const pool = hot.length ? hot : targets.filter((t) => t.priority === "Medium");
    if (!pool.length) return null;
    return pool[dayOfYear(getManilaDate()) % pool.length];
  }, [targets]);
  const [touchOpen, setTouchOpen] = useState(false);
  const [touchNote, setTouchNote] = useState("");
  const [touchSaving, setTouchSaving] = useState(false);
  const [touchLogged, setTouchLogged] = useState(false);
  const saveTouchpoint = async () => {
    const t = featuredTarget;
    if (!t) return;
    setTouchSaving(true);
    const today = isoDate(getManilaDate());
    const ins = await supabase
      .from("crosshairs_touchpoints")
      .insert({ target_id: t.id, note: touchNote.trim() || null, touchpoint_date: today });
    if (ins.error) console.warn("[Home] crosshairs_touchpoints unavailable — updating last_touchpoint_date only:", ins.error.message);
    const upd = await supabase.from("crosshairs_targets").update({ last_touchpoint_date: today }).eq("id", t.id);
    setTouchSaving(false);
    if (ins.error && upd.error) {
      console.warn("[Home] logging touchpoint failed:", upd.error.message);
      return;
    }
    setTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, last_touchpoint_date: today } : x)));
    setTouchNote("");
    setTouchOpen(false);
    setTouchLogged(true);
  };

  // ---- Pending invoices drawer ---------------------------------------------------
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoices, setPayInvoices] = useState(null);
  const [payFading, setPayFading] = useState({});
  const openPayDrawer = async () => {
    setPayOpen(true);
    setPayInvoices(null);
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount, due_date, status, clients(name)")
      .neq("status", "paid")
      .not("status", "is", null)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) console.warn("[Home] loading invoices failed:", error.message);
    setPayInvoices(data ?? []);
  };
  useEffect(() => {
    if (!payOpen) return;
    const onKey = (e) => e.key === "Escape" && setPayOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [payOpen]);
  const markPaid = async (inv) => {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_date: isoDate(getManilaDate()) })
      .eq("id", inv.id);
    if (error) {
      console.warn("[Home] marking invoice paid failed:", error.message);
      return;
    }
    setPayFading((f) => ({ ...f, [inv.id]: true }));
    setPulse((p) => ({ ...p, pending: p.pending == null ? p.pending : Math.max(0, p.pending - Number(inv.amount ?? 0)) }));
    setTimeout(() => setPayInvoices((list) => (list ?? []).filter((x) => x.id !== inv.id)), 300);
  };
  const payTotal = (payInvoices ?? []).filter((i) => !payFading[i.id]).reduce((sum, i) => sum + Number(i.amount ?? 0), 0);

  // ---- Morning ritual ---------------------------------------------------------
  const dismissRitual = () => {
    try {
      sessionStorage.setItem(RITUAL_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowRitual(false);
  };
  const completeRitual = async ({ feeling, energy, gratitude }) => {
    dismissRitual();
    setRitualDone(true);
    try {
      await checkIn.submit({
        energyLevel: energy == null ? null : energy + 1,
        feeling,
        gratitude: gratitude.trim() || null,
        mits: schema.current.mitColumns ? checkIn.todayLog?.mits ?? [] : mits,
      });
    } catch (e) {
      console.warn("[Home] saving ritual to daily_logs failed:", e.message);
    }
  };

  // ---- New task bar ---------------------------------------------------------------
  const [newTask, setNewTask] = useState("");
  const addNewTask = () => {
    const v = newTask.trim();
    if (!v) return;
    if (mits.length < 3) persistMits([...mits, v]);
    else addToHitlist(v);
    setNewTask("");
  };

  // ---- Weekly plan ------------------------------------------------------------------
  const [dragOverDay, setDragOverDay] = useState(null);
  const isMobile = useIsMobile();
  const weekDays = getWeekDates();
  const weekLabel = `Week of ${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()]}`;
  const dropOnDay = async (e, ds) => {
    e.preventDefault();
    setDragOverDay(null);
    const lb = e.dataTransfer.getData("text/plain");
    console.log(`Weekly plan drop on ${ds}: ${lb}`);
    if (!lb || !lb.trim()) return;
    placeChipOnDay(lb, ds, { saveLocally: false });
    // A MIT scheduled onto a day leaves the MIT list, so it can't come back
    // on the next load as both a MIT and a chip. persistMits() compacts the
    // list and nulls the freed mit_N column in today's daily_logs row.
    if (mits.includes(lb)) persistMits(mits.filter((m) => m !== lb));
    // Push to Google Calendar as 09:00–09:30 Manila; the next load shows it
    // as a meeting chip. Only an unexpired token counts as connected; nothing
    // here may open Google's sign-in popup.
    let pushed = false;
    if (!isGoogleCalendarConfigured() || !getAccessToken()) {
      console.log("Google Calendar not connected, falling back to localStorage for weekly plan drop");
    } else {
      try {
        const res = await createEvent({
          title: lb,
          start: manilaInstant(ds, "09:00:00"),
          end: manilaInstant(ds, "09:30:00"),
          reminderMinutes: 10,
        });
        pushed = !res?.skipped;
      } catch (err) {
        console.warn("[Home] Google Calendar push failed — saving the drop locally:", err.message);
      }
    }
    if (!pushed) saveWeeklyDrop(ds, lb);
  };

  // Drop on the time grid: schedule the task at ds + minutes after midnight (30-minute
  // snap). Saves a time block, pushes a Google Calendar event with a 30-minute alert,
  // and shows the chip at once.
  const dropOnSlot = async (label, source, ds, min) => {
    const time = `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
    const start = manilaInstant(ds, `${time}:00`);
    setWeekEvents((prev) => ({
      ...prev,
      [ds]: [...(prev[ds] ?? []), { t: "adm", l: label, timed: true, block: true, start, end: new Date(start.getTime() + 30 * 60000) }],
    }));
    if (source === "mit" && mits.includes(label)) persistMits(mits.filter((m) => m !== label));

    // Time block on that day's daily_logs row (today's is also in the Time blocks panel).
    if (ds === todayISO) {
      persistBlocks([...blocks, { time, label }]);
    } else if (schema.current.timeBlocks) {
      const { data: row } = await supabase.from("daily_logs").select("time_blocks").eq("log_date", ds).maybeSingle();
      const next = [...(Array.isArray(row?.time_blocks) ? row.time_blocks : []), { time, label }].sort((a, b) => a.time.localeCompare(b.time));
      const { error } = await supabase.from("daily_logs").upsert({ log_date: ds, time_blocks: next }, { onConflict: "log_date" });
      if (error) console.warn("[Home] saving time block failed:", error.message);
    }

    const res = await createCalendarEvent({ title: label, date: ds, time });
    showCalToast(
      res.ok ? `${label} scheduled ${ds} ${timeLabel(min)} — alert 30 min before` : `Scheduled here, but the calendar alert failed: ${res.error}`,
      res.ok
    );
  };

  // A task sits on exactly one day: drop its local chip (and saved drop) from
  // every day, then add it to `ds`. Chips from Supabase or Google stay put.
  const placeChipOnDay = (label, ds, { saveLocally = true } = {}) => {
    const moveDone = Object.values(weeklyDone).some((day) => day?.[label]);
    setWeekEvents((prev) => {
      const next = {};
      Object.entries(prev).forEach(([d, evs]) => {
        next[d] = evs.filter((c) => !(c.local && c.l === label));
      });
      next[ds] = [...(next[ds] ?? []), { t: "adm", l: label, local: true }];
      return next;
    });
    removeWeeklyDrop(label);
    if (saveLocally) saveWeeklyDrop(ds, label);
    if (moveDone) {
      Object.keys(weeklyDone).forEach((d) => d !== ds && setWeeklyDoneFor(d, label, false));
      setWeeklyDoneFor(ds, label, true);
    }
  };
  const removeLocalChip = (label) => {
    setWeekEvents((prev) =>
      Object.fromEntries(Object.entries(prev).map(([d, evs]) => [d, evs.filter((c) => !(c.local && c.l === label))]))
    );
    removeWeeklyDrop(label);
  };

  // ---- Due dates → weekly plan / month calendar ----------------------------------------
  const [taskDots, setTaskDots] = useState(() => readJson(CALENDAR_DOTS_KEY));
  const applyDueDate = (label, dueDate, oldLabel) => {
    // Clear any earlier placement of this task (under either name).
    const dots = readJson(CALENDAR_DOTS_KEY);
    Object.keys(dots).forEach((d) => {
      dots[d] = (dots[d] ?? []).filter((l) => l !== label && l !== oldLabel);
      if (!dots[d].length) delete dots[d];
    });
    if (oldLabel && oldLabel !== label) removeLocalChip(oldLabel);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate ?? "")) {
      const weekISO = getWeekDates().map(isoDate);
      if (weekISO.includes(dueDate)) {
        placeChipOnDay(label, dueDate);
      } else {
        removeLocalChip(label);
        dots[dueDate] = [...(dots[dueDate] ?? []), label];
      }
    }
    writeJson(CALENDAR_DOTS_KEY, dots);
    setTaskDots(dots);
  };

  // ---- MITs / hitlist / time blocks drag & drop ---------------------------------------
  const [overList, setOverList] = useState(null);
  const listDragProps = (name, onDrop) => ({
    onDragOver: (e) => {
      if (isZoneDrag(e)) return;
      e.preventDefault();
      setOverList(name);
    },
    onDragLeave: () => setOverList(null),
    onDrop: (e) => {
      if (isZoneDrag(e)) return;
      e.preventDefault();
      setOverList(null);
      onDrop(e.dataTransfer.getData("text/plain"), e.dataTransfer.getData("source"));
    },
  });

  const dropOnMits = (lb) => {
    if (lb && mits.length < 3 && !mits.includes(lb)) persistMits([...mits, lb]);
  };
  const dropOnHitlist = (lb, src) => {
    if (src !== "mit") return;
    if (!mits.includes(lb)) return;
    persistMits(mits.filter((m) => m !== lb));
    addToHitlist(lb);
  };
  const dropOnBlocks = (lb, src) => {
    if (!lb) return;
    if (src === "mit" && mits.includes(lb)) persistMits(mits.filter((m) => m !== lb));
    const now = getManilaDate();
    const next = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
    persistBlocks([...blocks, { time: `${pad(Math.floor(next / 60) % 24)}:${pad(next % 60)}`, label: lb }]);
  };

  const [tbTime, setTbTime] = useState("09:00");
  const [tbLabel, setTbLabel] = useState("");
  const tbLabelRef = useRef(null);
  const addTimeBlock = () => {
    const l = tbLabel.trim();
    if (!tbTime || !l) return;
    persistBlocks([...blocks, { time: tbTime, label: l }]);
    setTbLabel("");
  };
  const nowMin = (() => {
    const n = getManilaDate();
    return n.getHours() * 60 + n.getMinutes();
  })();

  // ---- Pomodoro -----------------------------------------------------------------------
  const [pomS, setPomS] = useState(POM_TOTAL);
  const [pomR, setPomR] = useState(false);
  useEffect(() => {
    if (!pomR) return;
    const id = setInterval(() => {
      setPomS((s) => {
        if (s <= 1) {
          setPomR(false);
          return POM_TOTAL;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomR]);
  const resetPom = () => {
    setPomR(false);
    setPomS(POM_TOTAL);
  };

  // ---- Shutdown -----------------------------------------------------------------------
  const [shut, setShut] = useState([false, false, false, false, false]);
  const shutCount = shut.filter(Boolean).length;

  // ---- Zone reorder -------------------------------------------------------------------
  const [zoneOrder, setZoneOrder] = useState(loadZoneOrder);
  const [hoverZone, setHoverZone] = useState(null);
  const [draggingZone, setDraggingZone] = useState(null);
  const [indicatorZone, setIndicatorZone] = useState(null);
  const dragZoneRef = useRef(null);

  const zoneProps = (id) => ({
    "data-zone-id": id,
    draggable: true,
    className: `zone-wrap${THIRD_ZONES.includes(id) ? " zone-third" : ""}${draggingZone === id ? " dragging" : ""}`,
    onMouseEnter: () => setHoverZone(id),
    onMouseLeave: () => setHoverZone((z) => (z === id ? null : z)),
    onDragStart: (e) => {
      if (e.target.classList?.contains("mit-row") || e.target.classList?.contains("bl-row")) return;
      dragZoneRef.current = id;
      setDraggingZone(id);
      e.dataTransfer.setData("zone-drag", "true");
      e.dataTransfer.effectAllowed = "move";
    },
    onDragEnd: () => {
      dragZoneRef.current = null;
      setDraggingZone(null);
      setIndicatorZone(null);
    },
    onDragOver: (e) => {
      if (!isZoneDrag(e)) return;
      e.preventDefault();
      setIndicatorZone(id);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setIndicatorZone((z) => (z === id ? null : z));
    },
    onDrop: (e) => {
      if (!isZoneDrag(e)) return;
      e.preventDefault();
      setIndicatorZone(null);
      const from = dragZoneRef.current;
      if (!from || from === id) return;
      setZoneOrder((order) => {
        // Reorder among the movable zones, then put the weekly plan back in its slot.
        const movable = order.filter((z) => z !== FIXED_ZONE);
        const fromIdx = movable.indexOf(from);
        const toIdx = movable.indexOf(id);
        const rest = movable.filter((z) => z !== from);
        const at = rest.indexOf(id);
        rest.splice(fromIdx < toIdx ? at + 1 : at, 0, from);
        const next = withFixedZone(rest);
        try {
          localStorage.setItem(ZONE_ORDER_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
  });

  const zoneHead = (id, label, purple = false) =>
    id === FIXED_ZONE ? (
      <div className="zlbl zlbl-fixed">{label}</div>
    ) : (
      <>
        <div id={`di-${id}`} className={`drop-indicator${indicatorZone === id ? " show" : ""}`}></div>
        <div className={`zlbl${purple ? " pur" : ""}`}>
          <DragHandle visible={hoverZone === id} />
          {label}
        </div>
      </>
    );

  // ---- Topbar brief -------------------------------------------------------------------
  const brief = useMemo(() => {
    if (pulse.rfqs == null) return "Loading today's brief…";
    const parts = [`${pulse.rfqs} RFQ${pulse.rfqs === 1 ? "" : "s"} unanswered`];
    if (soonestRfq) {
      const ref = soonestRfq.rfq_number || soonestRfq.title;
      const d = daysAgo(soonestRfq.closing_date);
      const when = d === 0 ? "today" : d === -1 ? "tomorrow" : (() => {
        const [, mo, dd] = soonestRfq.closing_date.split("-").map(Number);
        return `${dd} ${MONTHS[mo - 1]}`;
      })();
      parts.push(`${ref} closes ${when}`);
    }
    return parts.join(" · ");
  }, [pulse.rfqs, soonestRfq]);

  // ---- Learning hub -------------------------------------------------------------------
  // Today's generated module, or the active learning_topics row as a fallback
  // (description as the takeaway, no application line).
  const hubCard = learnModule
    ? {
        title: learnModule.book_title,
        author: learnModule.book_author,
        color: learnModule.cover_color || "#3b82f6",
        initial: (learnModule.cover_initial || learnModule.book_title || "?").charAt(0).toUpperCase(),
        takeaway: sentences(learnModule.key_takeaway || learnModule.description).slice(0, 3),
        application: sentences(learnModule.application).slice(0, 2),
      }
    : topic
      ? {
          title: topic.title,
          author: topic.category ?? "",
          color: "#3b82f6",
          initial: (topic.title ?? "?").trim().charAt(0).toUpperCase(),
          coverUrl: topicCoverUrl(topic),
          takeaway: sentences(topic.description).slice(0, 3),
          application: [],
        }
      : null;

  // ---- Month calendar -----------------------------------------------------------------
  const calCells = useMemo(() => {
    const { y, m } = calMonth;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    return { first, days };
  }, [calMonth]);
  const shiftMonth = (delta) =>
    setCalMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const prevMonthName = MONTHS[(calMonth.m + 11) % 12];
  const nextMonthName = MONTHS[(calMonth.m + 1) % 12];
  const monthTitle = `${MONTHS_LONG[calMonth.m]} ${calMonth.y}`;

  // ---- Zones --------------------------------------------------------------------------
  const staleCount = hitlistView.filter((t) => t.age > 14).length;

  const zones = {
    pulse: (
      <div key="pulse" {...zoneProps("pulse")}>
        {zoneHead("pulse", "Business pulse")}
        <div className="pulse">
          <div className="stat blue" onClick={() => navigate("/pipeline")}>
            <div className="stat-n" style={{ color: "var(--red)" }}>{pulse.rfqs ?? "—"}</div>
            <div className="stat-lbl">RFQs unanswered</div>
            <div className="stat-lnk">↗ Pipeline</div>
          </div>
          <div className="stat blue" onClick={() => navigate("/pipeline")}>
            <div className="stat-n" style={{ color: "var(--orange)" }}>{pulse.pos ?? "—"}</div>
            <div className="stat-lbl">POs undelivered</div>
            <div className="stat-lnk">↗ Pipeline</div>
          </div>
          <div className="stat amber" onClick={openPayDrawer}>
            <div className="stat-n" style={{ color: "var(--amber)" }}>{formatPeso(pulse.pending)}</div>
            <div className="stat-lbl">Pending payment</div>
            <div
              className="stat-lnk am"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/ledger");
              }}
            >
              ↗ Ledger
            </div>
          </div>
          <div className="stat green" onClick={() => navigate("/pipeline")}>
            <div className="stat-n" style={{ color: "var(--green)" }}>{pulse.completed ?? "—"}</div>
            <div className="stat-lbl">Completed this year</div>
            <div className="stat-lnk gr">↗ History</div>
          </div>
        </div>
      </div>
    ),

    weekly: (
      <div key="weekly" data-zone-id="weekly" className="zone-wrap">
        {zoneHead(
          "weekly",
          <>
            <span>{weekLabel}</span>
            {gcalState === "none" && (
              <button className="zl-connect" onClick={() => navigate("/settings")}>Connect Calendar</button>
            )}
          </>
        )}
        <div className="card">
          {isMobile ? (
          <div className="week-scroll">
          <div className="week-grid">
            {weekDays.map((d) => {
              const ds = isoDate(d);
              const evs = weekEvents[ds] ?? [];
              return (
                <div
                  key={ds}
                  className={`wday${dragOverDay === ds ? " drag-over-day" : ""}`}
                  onDragOver={(e) => {
                    if (isZoneDrag(e)) return;
                    e.preventDefault();
                    setDragOverDay(ds);
                  }}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(e) => !isZoneDrag(e) && dropOnDay(e, ds)}
                >
                  <div className="wd-n">{DAYNAMES[d.getDay()]}</div>
                  {ds === todayISO ? <div className="wd-tod">{d.getDate()}</div> : <div className="wd-d">{d.getDate()}</div>}
                  {evs.length ? (
                    evs.map((ev, i) => (
                      <div
                        key={i}
                        className={`ev ev-${ev.t}${isWeeklyDone(ds, ev.l) ? " ev-done" : ""}`}
                        title={ev.l}
                        {...clickOrDouble(() => openWeekPanel(ds, ev, i), () => setWeeklyDoneFor(ds, ev.l, !isWeeklyDone(ds, ev.l)))}
                      >
                        {ev.l}
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="ev-emp"></div>
                      <div className="ev-emp"></div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          </div>
          ) : (
            <WeekTimeGrid
              days={weekDays.map((d) => {
                const ds = isoDate(d);
                const entries = (weekEvents[ds] ?? []).map((ev, idx) => ({ ev, idx }));
                return {
                  ds,
                  name: DAYNAMES[d.getDay()],
                  num: d.getDate(),
                  isToday: ds === todayISO,
                  untimed: entries.filter(({ ev }) => !ev.timed),
                  timed: entries.filter(({ ev }) => ev.timed),
                };
              })}
              renderChip={(ds, ev, i) => (
                <div
                  key={i}
                  className={`ev ev-${ev.t}${isWeeklyDone(ds, ev.l) ? " ev-done" : ""}`}
                  title={ev.l}
                  {...clickOrDouble(() => openWeekPanel(ds, ev, i), () => setWeeklyDoneFor(ds, ev.l, !isWeeklyDone(ds, ev.l)))}
                >
                  {ev.l}
                </div>
              )}
              onChipClick={openWeekPanel}
              onDropTask={dropOnSlot}
              onHeaderDrop={dropOnDay}
              dragOverDay={dragOverDay}
              setDragOverDay={setDragOverDay}
            />
          )}
        </div>
      </div>
    ),

    focus: (
      <div key="focus" {...zoneProps("focus")}>
        {zoneHead("focus", "Focus engine")}
        <div className="focus-hero">
          <div className="focus-grid">
            <div className="focus-left">
              <div className="focus-panel">
                <div className="fp-head">
                  <span className="fp-title">
                    <Icon>{ICONS.list}</Icon>Most important tasks <span style={{ color: "var(--t4)", fontWeight: 500 }}>({mits.length}/3)</span>
                  </span>
                  <span className="fp-action" style={{ fontSize: 10, color: "var(--t4)" }}>drag to schedule →</span>
                </div>
                <div className={`mit-drop${overList === "mits" ? " drag-over-list" : ""}`} {...listDragProps("mits", dropOnMits)}>
                  {mits.length === 0 ? (
                    <div className="mit-empty">No MITs yet. Use the task bar above.</div>
                  ) : (
                    mits.map((m, i) => (
                      <div
                        key={`${i}-${m}`}
                        className={`mit-row${mitState[i]?.done ? " mit-done" : ""}`}
                        {...clickOrDouble(() => openMitPanel(i), () => toggleMitDone(i))}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", m);
                          e.dataTransfer.setData("source", "mit");
                        }}
                      >
                        <div className="mit-n">{i + 1}</div>
                        <div className="mit-t">{m}</div>
                        <button
                          className="mit-del"
                          onClick={(e) => {
                            e.stopPropagation();
                            persistMits(mits.filter((_, idx) => idx !== i));
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="mit-foot">
                  <svg viewBox="0 0 24 24">{ICONS.pin}</svg>Suggested by Claude from open items · Drag to Time Blocks or Weekly Plan to schedule
                </div>
              </div>
              <div className="fp-divider"></div>
              <div className="focus-panel">
                <div className="fp-head">
                  <span className="fp-title"><Icon>{ICONS.book}</Icon>Learning Hub</span>
                  <span className="fp-action" onClick={() => navigate("/learning-hub")}>Continue →</span>
                </div>
                <div className="hub-body hub2">
                  {hubCard ? (
                    <>
                      <div className="hub2-head">
                        {hubCard.coverUrl ? (
                          <img className="hub2-cover" src={hubCard.coverUrl} alt="" />
                        ) : (
                          <div className="hub2-cover" style={{ background: hubCard.color }}>{hubCard.initial}</div>
                        )}
                        <div className="hub2-titles">
                          <div className="hub2-title">{hubCard.title}</div>
                          {hubCard.author && <div className="hub2-author">{hubCard.author}</div>}
                        </div>
                      </div>
                      {hubCard.takeaway.length > 0 && (
                        <div className="hub2-takeaway">
                          {hubCard.takeaway.map((t, i) => <p key={i}>{t}</p>)}
                        </div>
                      )}
                      {hubCard.application.length > 0 && (
                        <div className="hub2-app">
                          {hubCard.application.map((t, i) => <p key={i}>{t}</p>)}
                        </div>
                      )}
                      <div className="hub2-foot">
                        <div className="hub2-bar"><div className="hub2-fill" style={{ width: `${topic?.progress_percent ?? 0}%` }}></div></div>
                        <span className="hub2-streak">🔥 {topic?.current_streak ?? 0}-day streak</span>
                      </div>
                    </>
                  ) : (
                    <div className="hub-book">No active learning topic.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="focus-right">
              <div className="fp-head">
                <span className="fp-title"><Icon>{ICONS.clock}</Icon>Time blocks</span>
                <span className="fp-action" onClick={() => tbLabelRef.current?.focus()}>+ Add</span>
              </div>
              <div className={`tb-area${overList === "blocks" ? " drag-over-list" : ""}`} {...listDragProps("blocks", dropOnBlocks)}>
                {blocks.length === 0 ? (
                  <div className="tb-emp">Drop MITs or Hitlist tasks here,<br />or use + Add below.</div>
                ) : (
                  blocks.map((b, i) => {
                    const [h, m] = b.time.split(":").map(Number);
                    const act = Math.abs(h * 60 + m - nowMin) < 60;
                    return (
                      <div
                        key={i}
                        className={`tb-row${act ? " act" : ""}${b.done ? " tb-done" : ""}`}
                        {...clickOrDouble(() => openBlockPanel(i), () => toggleBlockDone(i))}
                      >
                        <span className="tb-tm">{b.time}</span>
                        <span className="tb-nm">{b.label}</span>
                        {act && <span className="tb-now">Now</span>}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="tb-add">
                <input type="time" value={tbTime} onChange={(e) => setTbTime(e.target.value)} />
                <input
                  ref={tbLabelRef}
                  type="text"
                  placeholder="Block label…"
                  value={tbLabel}
                  onChange={(e) => setTbLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTimeBlock()}
                />
                <button onClick={addTimeBlock}>Add</button>
              </div>
              <div className="pom">
                <div className="pom-ring-wrap">
                  <svg className="pom-ring-svg" viewBox="0 0 44 44">
                    <circle className="pom-ring-bg" cx="22" cy="22" r="19" />
                    <circle
                      className={`pom-ring-fg${pomR ? " running" : ""}`}
                      cx="22"
                      cy="22"
                      r="19"
                      strokeDasharray="119.4 119.4"
                      strokeDashoffset="0"
                      style={{ strokeDasharray: `${CIRC} ${CIRC}`, strokeDashoffset: CIRC * (1 - pomS / POM_TOTAL) }}
                    />
                  </svg>
                  <div className="pom-time">{pad(Math.floor(pomS / 60))}:{pad(pomS % 60)}</div>
                </div>
                <div className="pom-info">
                  <div className="pom-label">Pomodoro — Focus</div>
                  <div className="pom-sub">Select an MIT to link</div>
                </div>
                <div className="pom-btns">
                  <button className={pomR ? "pom-btn" : "pom-btn go"} onClick={() => setPomR((r) => !r)}>{pomR ? "Pause" : "Start"}</button>
                  <button className="pom-btn" onClick={resetPom}>Reset</button>
                  <button className="pom-music" onClick={() => window.open(LOFI_URL, "_blank", "noopener")}>🎵 Lofi</button>
                </div>
              </div>
              <div className="shut" style={shutCount === 5 ? { display: "none" } : undefined}>
                <div className="shut-hdr">Shutdown Ritual <span className="shut-count">{shutCount}/5</span></div>
                <div className="shut-items">
                  {SHUTDOWN_ITEMS.map((label, i) => (
                    <label key={label} className="shut-item">
                      <input
                        type="checkbox"
                        checked={shut[i]}
                        onChange={() => setShut((s) => s.map((v, j) => (j === i ? !v : v)))}
                      />{" "}
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="shut-done" style={shutCount === 5 ? { display: "block" } : undefined}>
                <div className="shut-done-icon">🎉</div>
                <div className="shut-done-text">Success! Enjoy the rest of your day, {firstName}.</div>
                <div className="shut-done-sub">All checks complete. Work is closed. Tomorrow is planned.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),

    crosshairs: (
      <div key="crosshairs" {...zoneProps("crosshairs")}>
        {zoneHead("crosshairs", "Crosshairs", true)}
        <div className="card">
          <div className="ch">
            <span className="ch-t" style={{ color: "var(--purple)" }}><Icon>{ICONS.target}</Icon>Crosshairs</span>
            <span className="ch-a pur" onClick={() => navigate("/crosshairs")}>+ Add</span>
          </div>
          {targets.length === 0 && <div className="mit-empty">No targets yet.</div>}
          {featuredTarget && (() => {
            const s = PRIORITY_STYLE[featuredTarget.priority] ?? PRIORITY_STYLE.Low;
            return (
              <div className="xh-feat">
                <div className="xh-feat-label">Today's target</div>
                <div className="xh-feat-name" onClick={() => openCrosshairsPanel(featuredTarget)}>{featuredTarget.target_name}</div>
                <div className="xh-feat-badges">
                  {featuredTarget.industry && <span className="bdg bdg-gr">{featuredTarget.industry}</span>}
                  <span className={`bdg ${s.bdg}`}>{s.label}</span>
                </div>
                {featuredTarget.next_suggested_action && (
                  <div className="xh-feat-next">
                    <svg viewBox="0 0 24 24">{ICONS.compass}</svg>
                    {featuredTarget.next_suggested_action}
                  </div>
                )}
                <div className="xh-feat-div"></div>
                {touchLogged && !touchOpen ? (
                  <div className="xh-feat-ok">✓ Touchpoint logged</div>
                ) : (
                  <button className="xh-log" onClick={() => setTouchOpen((o) => !o)}>
                    {touchOpen ? "Cancel" : "+ Log Touchpoint"}
                  </button>
                )}
                {touchOpen && (
                  <div className="xh-touch">
                    <textarea
                      rows={1}
                      value={touchNote}
                      placeholder="Note what happened..."
                      onChange={(e) => setTouchNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveTouchpoint();
                        }
                      }}
                    />
                    <button onClick={saveTouchpoint} disabled={touchSaving}>{touchSaving ? "Saving…" : "Save"}</button>
                  </div>
                )}
              </div>
            );
          })()}
          {targets.filter((t) => t.id !== featuredTarget?.id).slice(0, GROWTH_ROWS - (featuredTarget ? 1 : 0)).map((t) => {
            const s = PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.Low;
            return (
              <div key={t.id} className="xh-row" onClick={() => openCrosshairsPanel(t)}>
                <div className="xh-dot" style={{ background: s.dot }}></div>
                <div className="xh-n">{t.target_name}</div>
                <span className={`bdg ${s.bdg}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    ),

    hitlist: (
      <div key="hitlist" {...zoneProps("hitlist")}>
        {zoneHead("hitlist", "Hitlist")}
        <div className="card">
          <div className="ch">
            <span className="ch-t"><Icon>{ICONS.list}</Icon>Hitlist</span>
            <span className="bdg bdg-r" style={{ marginRight: 6 }}>{staleCount} stale</span>
            <span className="ch-a" onClick={() => window.open(`https://app.clickup.com/${CLICKUP_WORKSPACE_ID}/home`, "_blank", "noopener")}>ClickUp ↗</span>
          </div>
          <div className={`bl-area${overList === "hitlist" ? " drag-over-list" : ""}`} {...listDragProps("hitlist", dropOnHitlist)}>
            {hitlistView.length === 0 && <div className="mit-empty">{hitlistError ? "ClickUp unavailable." : "Nothing on the hitlist."}</div>}
            {hitlistView.slice(0, GROWTH_ROWS).map((t) => {
              const color = t.age > 14 ? "var(--red)" : t.age >= 7 ? "var(--orange)" : "var(--t4)";
              return (
                <div
                  key={t.id}
                  className={`bl-row${hitlistMeta[t.id]?.done ? " bl-done" : ""}`}
                  onClick={() => openHitlistPanel(t)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", hitlistMeta[t.id]?.label ?? t.label);
                    e.dataTransfer.setData("source", "hitlist");
                  }}
                >
                  <div className="bl-dot" style={{ background: color }}></div>
                  <div className="bl-n">{hitlistMeta[t.id]?.label ?? t.label}</div>
                  {t.source === "clickup" && <span className="bdg bdg-gr" style={{ marginRight: 6 }}>CU</span>}
                  {t.source === "mc" && <span className="bdg bdg-b" style={{ marginRight: 6 }}>MC</span>}
                  <span className="bl-age" style={{ color: color === "var(--t4)" ? "var(--t3)" : color }}>{t.age}d</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ),

    brewing: (
      <div key="brewing" {...zoneProps("brewing")}>
        {zoneHead("brewing", "Brewing", true)}
        <div className="card">
          <div className="ch">
            <span className="ch-t" style={{ color: "var(--purple)" }}><Icon>{ICONS.flame}</Icon>Brewing</span>
            <span className="ch-a pur" onClick={() => navigate("/brewing")}>+ Add</span>
          </div>
          {brewing.length === 0 && <div className="mit-empty">Nothing brewing.</div>}
          {brewing.slice(0, GROWTH_ROWS).map((b) => {
            const s = BREWING_STYLE[b.status] ?? BREWING_STYLE.Idea;
            return (
              <div key={b.id} className="br-row" onClick={() => openBrewingPanel(b)}>
                <div className="br-dot" style={{ background: s.dot }}></div>
                <div className="br-n">{b.name}</div>
                <span className={`bdg ${s.bdg}`}>{b.status}</span>
              </div>
            );
          })}
        </div>
      </div>
    ),

    calendar: (
      <div key="calendar" {...zoneProps("calendar")}>
        {zoneHead("calendar", monthTitle)}
        <div className="card">
          <div className="cal-wrap">
            <div className="cal-hdr">
              <button className="cal-nav" onClick={() => shiftMonth(-1)}>← {prevMonthName}</button>
              <span className="cal-month">{monthTitle}</span>
              <button className="cal-nav" onClick={() => shiftMonth(1)}>{nextMonthName} →</button>
            </div>
            <div className="cal-grid">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="cal-dow">{d}</div>
              ))}
              {Array.from({ length: calCells.first }, (_, i) => (
                <div key={`e${i}`} className="cal-d emp"></div>
              ))}
              {Array.from({ length: calCells.days }, (_, i) => {
                const d = i + 1;
                const ds = `${calMonth.y}-${pad(calMonth.m + 1)}-${pad(d)}`;
                const isToday = ds === todayISO;
                const base = monthDots[ds] ?? [];
                // Task due dates (mc_calendar_dots) get their own teal dot.
                const dots = isToday ? [] : taskDots[ds]?.length ? [...base, "task"] : base;
                return (
                  <div key={ds} className={`cal-d${isToday ? " today" : ""}`}>
                    {d}
                    {dots.map((c, j) => (
                      <div
                        key={c}
                        className="cdot"
                        style={{ background: c === "task" ? TASK_DOT_COLOR : `var(--${c})`, left: `calc(50% + ${(j - (dots.length - 1) / 2) * 5}px)` }}
                      ></div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="cal-leg">
              <div className="leg"><div className="leg-d" style={{ background: "var(--amber)" }}></div>RFQ closes</div>
              <div className="leg"><div className="leg-d" style={{ background: "var(--green)" }}></div>Delivery</div>
              <div className="leg"><div className="leg-d" style={{ background: "var(--blue)" }}></div>Invoice due</div>
              <div className="leg"><div className="leg-d" style={{ background: TASK_DOT_COLOR }}></div>Task due</div>
              <div className="leg"><div className="leg-d" style={{ background: "var(--purple)" }}></div>Meetings</div>
            </div>
          </div>
        </div>
      </div>
    ),
  };

  const newTaskBar = (
    <div key="new-task" className="new-task-bar">
      <span className="nt-icon">✦</span>
      <input
        type="text"
        placeholder="New task — Enter adds to MITs if under 3, otherwise to Hitlist…"
        maxLength={120}
        value={newTask}
        onChange={(e) => setNewTask(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && addNewTask()}
      />
      <span className="nt-hint">drag to Hitlist ↓</span>
      <button className="nt-btn" onClick={addNewTask}>Add</button>
    </div>
  );

  return (
    <>
      <style>{homeCss}</style>

      {showRitual && (
        <MorningRitual
          firstName={firstName}
          mit1={mits[0]}
          hotTarget={targets[0]}
          seoOkr={seoOkr}
          onClose={dismissRitual}
          onComplete={completeRitual}
        />
      )}

      <div className={`pd-overlay${payOpen ? " open" : ""}`} onClick={() => setPayOpen(false)}></div>
      <aside className={`pd-drawer${payOpen ? " open" : ""}`} aria-hidden={!payOpen} aria-label="Pending invoices">
        <div className="pd-head">
          <span className="pd-title">Pending Invoices</span>
          <button className="pd-close" onClick={() => setPayOpen(false)} aria-label="Close">✕</button>
        </div>
        <div className="pd-body">
          {payInvoices === null ? (
            <div className="pd-loading">Loading…</div>
          ) : payInvoices.length === 0 ? (
            <div className="pd-empty">
              <div className="pd-empty-icon">✅</div>
              <div className="pd-empty-title">All invoices paid</div>
              <div className="pd-empty-sub">Great work</div>
            </div>
          ) : (
            payInvoices.map((inv) => {
              const overdue = inv.due_date && inv.due_date < todayISO;
              return (
                <div key={inv.id} className="pd-card" style={{ opacity: payFading[inv.id] ? 0 : 1 }}>
                  <div className="pd-row">
                    <span className="pd-num">{inv.invoice_number || "Invoice"}</span>
                    <span className="pd-amt">{pesoFull(inv.amount)}</span>
                  </div>
                  <div className="pd-row pd-meta">
                    <span>{inv.clients?.name ?? "—"}</span>
                    <span className={overdue ? "pd-overdue" : ""}>{inv.due_date ? `${overdue ? "Overdue · " : "Due "}${inv.due_date}` : "No due date"}</span>
                  </div>
                  <button className="pd-pay" onClick={() => markPaid(inv)} disabled={payFading[inv.id]}>Mark as Paid</button>
                </div>
              );
            })
          )}
        </div>
        <div className="pd-foot">
          <span className="pd-foot-label">Total outstanding</span>
          <span className="pd-total">{pesoFull(payTotal)}</span>
        </div>
      </aside>

      <TaskPanel
        open={panelOpen}
        task={panelTask}
        hierarchy={hierarchy}
        onClose={closePanel}
        onSave={savePanel}
        onDelete={deletePanelTask}
      />

      {calToast && <div className={`cal-toast${calToast.ok ? "" : " bad"}`} role="status">{calToast.msg}</div>}

      <MobileNav />

      <div className="shell">
        <Sidebar fullName={fullName} ritualDone={ritualDone || checkIn.isComplete} />

        <div className="main">
          <div className="topbar">
            <div className="tb-greeting">
              <div className="tb-title">{greetingWord()}, {firstName}.</div>
              <div className="tb-brief" title={aiBrief ?? brief}>
                <svg viewBox="0 0 24 24">{ICONS.sparkle}</svg>
                <span className="tb-brief-text">{aiBrief ?? brief}</span>
              </div>
            </div>
            <div className="tb-r">
              <div className="pill">✦ On Full Send</div>
              <button className="btn-s" onClick={loadAll} disabled={syncing}>{syncing ? "Syncing…" : "Sync"}</button>
              <button className="btn-p" onClick={() => navigate("/intake")}>+ New RFQ</button>
            </div>
          </div>

          {rfqAlerts.length > 0 && (
            <div className="alert-banner" role="alert">
              <svg viewBox="0 0 24 24">{ICONS.warn}</svg>
              <span className="alert-text">
                {rfqAlerts.length} quotation{rfqAlerts.length === 1 ? "" : "s"} auto-rejected after 45 days:{" "}
                {[...new Set(rfqAlerts.map((a) => a.rfq_number))].join(", ")}
              </span>
              <button className="alert-x" onClick={dismissAlerts} aria-label="Dismiss">✕</button>
            </div>
          )}
          {gcalState === "expired" && (
            <div className="gcal-banner">
              Google Calendar token expired.{" "}
              <button onClick={() => navigate("/settings")}>Reconnect in Settings</button>
            </div>
          )}

          <div className="page">
            {zoneOrder.map((id) => (
              <Fragment key={id}>
                {zones[id]}
                {/* The task bar is pinned directly below the (fixed) Weekly Plan. */}
                {id === FIXED_ZONE && newTaskBar}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
