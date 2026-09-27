import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useCheckIn } from "../lib/CheckInContext";
import CheckInGate from "../components/CheckInGate";
import { useBusinessPulse } from "../lib/useBusinessPulse";
import { useWeekEvents } from "../lib/useWeekEvents";
import { useMonthEvents } from "../lib/useMonthEvents";
import { daysInMonth } from "../lib/dateUtils";
import { fetchTopics, loggedToday } from "../lib/learningHub";
import { fetchTargets } from "../lib/crosshairs";
import { useClickUpTasks } from "../lib/useClickUpTasks";
import { CLICKUP_WORKSPACE_ID } from "../lib/clickup";
import { fetchBrewingItems, createBrewingItem } from "../lib/brewing";
import { useLocalStorage } from "../lib/useLocalStorage";
import { todayISODate } from "../lib/dateUtils";
import {
  HomeIcon,
  PipelineIcon,
  IntakeIcon,
  SourcingIcon,
  QuoteIcon,
  LedgerIcon,
  CrosshairsIcon,
  OkrIcon,
  TrophyIcon,
  BrewingIcon,
  ContentIcon,
  SeoIcon,
  ContactsIcon,
  LearningIcon,
  SettingsIcon,
  ChevronLeftIcon,
  SparkleIcon,
  LogoMark,
} from "../components/icons";

/* =========================================================================
   This entire page is intentionally self-contained: every color, size, and
   spacing value below is a literal hex/px pulled straight from the spec,
   not a shared Tailwind token — nothing here is imported from
   tailwind.config.js or src/index.css. All other routes keep using the
   shared Sidebar/TopBar/Layout components untouched; this file supplies
   its own instead (wired in as a route sibling to <Layout/> in App.jsx).
   ========================================================================= */

const COLOR = {
  bg: "#f0f2f5",
  card: "#ffffff",
  border: "#e2e8f0",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  blue: "#3b82f6",
  blueLight: "#eff6ff",
  blueDark: "#1e40af",
  purple: "#7c3aed",
  purpleLight: "#f5f3ff",
  purpleDark: "#4c1d95",
  amber: "#f59e0b",
  amberDark: "#d97706",
  amberLight: "#fef3c7",
  amberText: "#92400e",
  green: "#10b981",
  greenLight: "#d1fae5",
  greenText: "#065f46",
  red: "#ef4444",
  orange: "#f97316",
  rowLine: "#f8fafc",
  headerLine: "#f1f5f9",
  fafafa: "#fafafa",
  cellEmpty: "#cbd5e1",
};

const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04)";

const CHIP_COLORS = {
  amber: { bg: COLOR.amberLight, text: COLOR.amberText },
  green: { bg: COLOR.greenLight, text: COLOR.greenText },
  purple: { bg: "#ede9fe", text: COLOR.purpleDark },
  blue: { bg: "#dbeafe", text: COLOR.blueDark },
};

const DOT_SOLID = {
  amber: COLOR.amber,
  green: COLOR.green,
  blue: COLOR.blue,
  purple: COLOR.purple,
};

/* -------------------------------------------------------------------------
   Small local icons — not in components/icons.jsx, defined here so this
   page stays self-contained rather than adding to the shared icon set.
   ------------------------------------------------------------------------- */
const iconBase = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

function ClockIcon(p) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
function StackIcon(p) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...p}>
      <path d="m12 3 9 4.5-9 4.5-9-4.5Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  );
}
function FlameIcon(p) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2c1 3-2 4.5-2 7.5A2 2 0 0 0 12 12a2 2 0 0 0 2-2.2c1.4 1 2.5 2.9 2.5 5A4.5 4.5 0 0 1 12 19a4.5 4.5 0 0 1-4.5-4.5C7.5 10.5 10.5 8.5 12 2Z" />
    </svg>
  );
}
function ListNumbersIcon(p) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...p}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 5.5v2M4 7.5h1M4.2 12.2c.2-.6.9-.9 1.4-.6.5.3.5.9.1 1.3l-1.4 1.4h1.9" />
    </svg>
  );
}
function BookIcon(p) {
  return <LearningIcon {...p} />;
}

/* -------------------------------------------------------------------------
   Date helpers — computed in Asia/Manila wall-clock time regardless of the
   browser/server's own timezone, per spec.
   ------------------------------------------------------------------------- */
function manilaNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day"), hour: get("hour") };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoOf(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Home() {
  const manila = manilaNow();
  const manilaDate = new Date(manila.year, manila.month, manila.day);
  const manilaDow = manilaDate.getDay(); // 0 Sun .. 6 Sat
  const todayISO = isoOf(manila.year, manila.month, manila.day);
  const greetingWord = manila.hour < 12 ? "Good morning" : manila.hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ display: "flex", height: "100vh", background: COLOR.bg, overflow: "hidden" }}>
      <HomeSidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <HomeTopBar greetingWord={greetingWord} />
        <main style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <BusinessPulseZone />
            <WeeklyPlanZone todayISO={todayISO} manilaDow={manilaDow} manila={manila} />
            <FocusEngineZone />
            <GrowthLayerZone />
            <MonthCalendarZone todayISO={todayISO} manila={manila} />
          </div>
        </main>
      </div>
      <CheckInGate />
    </div>
  );
}

/* =========================================================================
   Section label
   ========================================================================= */
function SectionLabel({ children, tone = "blue" }) {
  const color = tone === "purple" ? COLOR.purple : COLOR.blue;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span
        style={{
          fontSize: 8,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
      <span style={{ flex: 1, height: 1, background: COLOR.border }} />
    </div>
  );
}

function cardStyle(extra) {
  return {
    background: COLOR.card,
    border: `1px solid ${COLOR.border}`,
    borderRadius: 8,
    boxShadow: CARD_SHADOW,
    ...extra,
  };
}

/* =========================================================================
   SIDEBAR
   ========================================================================= */
const NAV_SECTIONS = [
  { label: null, items: [{ to: "/", label: "Home", icon: HomeIcon, end: true }] },
  {
    label: "Operations",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: PipelineIcon },
      { to: "/intake", label: "Intake", icon: IntakeIcon },
      { to: "/sourcing", label: "Sourcing", icon: SourcingIcon },
      { to: "/quote-builder", label: "Quote Builder", icon: QuoteIcon },
      { to: "/ledger", label: "Ledger", icon: LedgerIcon },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/crosshairs", label: "Crosshairs", icon: CrosshairsIcon, tone: "purple" },
      { to: "/wins", label: "Wins", icon: TrophyIcon },
      { to: "/okrs", label: "OKRs", icon: OkrIcon, tone: "purple" },
      { to: "/brewing", label: "Brewing", icon: BrewingIcon },
      { to: "/content", label: "Content", icon: ContentIcon, tone: "purple" },
      { to: "/seo", label: "SEO", icon: SeoIcon, tone: "purple" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/contacts", label: "Contacts", icon: ContactsIcon },
      { to: "/learning-hub", label: "Learning Hub", icon: LearningIcon },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

function HomeSidebar() {
  const { user, signOut } = useAuth();
  const { isComplete } = useCheckIn();

  return (
    <aside
      style={{
        width: 156,
        flexShrink: 0,
        background: "#ffffff",
        borderRight: `1px solid ${COLOR.border}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "12px 10px", borderBottom: `1px solid ${COLOR.border}` }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${COLOR.blue}, ${COLOR.purple})`,
          }}
        >
          <LogoMark style={{ width: 13, height: 13, color: "#fff" }} />
        </div>
        <div style={{ minWidth: 0, flex: 1, lineHeight: 1.3 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: COLOR.textPrimary, wordBreak: "break-word" }}>
            Mission Control
          </p>
          <p style={{ margin: 0, fontSize: 9, color: COLOR.textSecondary, wordBreak: "break-word" }}>Ultra Power</p>
          <p style={{ margin: 0, fontSize: 9, color: COLOR.textMuted, wordBreak: "break-word" }}>
            Engineering Solutions Director
          </p>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && (
              <p
                style={{
                  margin: "0 0 3px 8px",
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: COLOR.textMuted,
                  fontWeight: 500,
                }}
              >
                {section.label}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {section.items.map(({ to, label, icon: Icon, end, tone }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  style={({ isActive }) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 10,
                    padding: "5px 8px",
                    marginRight: 4,
                    borderRadius: "0 5px 5px 0",
                    textDecoration: "none",
                    borderLeft: isActive
                      ? `2px solid ${tone === "purple" ? COLOR.purple : COLOR.blue}`
                      : "2px solid transparent",
                    background: isActive ? (tone === "purple" ? COLOR.purpleLight : COLOR.blueLight) : "transparent",
                    color: isActive ? (tone === "purple" ? COLOR.purpleDark : COLOR.blueDark) : COLOR.textSecondary,
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        style={{
                          width: 13,
                          height: 13,
                          flexShrink: 0,
                          color: isActive ? (tone === "purple" ? COLOR.purple : COLOR.blue) : COLOR.textMuted,
                        }}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderTop: `1px solid ${COLOR.border}` }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background: isComplete ? COLOR.green : "#cbd5e1",
          }}
        />
        <p style={{ margin: 0, flex: 1, fontSize: 9, color: COLOR.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user?.email ?? "—"}
        </p>
        <button
          onClick={signOut}
          style={{ fontSize: 9, color: COLOR.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

/* =========================================================================
   TOPBAR
   ========================================================================= */
function HomeTopBar({ greetingWord }) {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  return (
    <header
      style={{
        height: 44,
        flexShrink: 0,
        background: "#ffffff",
        borderBottom: `1px solid ${COLOR.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 14px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: COLOR.textPrimary, whiteSpace: "nowrap" }}>
          {greetingWord}, Khalil.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <SparkleIcon style={{ width: 9, height: 9, color: COLOR.purple, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: COLOR.blue, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Five RFQs are quiet this week — worth a nudge before Friday.
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          padding: "3px 10px",
          borderRadius: 999,
          background: "#dbeafe",
          color: COLOR.blueDark,
          whiteSpace: "nowrap",
        }}
      >
        On Full Send
      </span>

      <button
        onClick={() => {
          setSyncing(true);
          window.location.reload();
        }}
        disabled={syncing}
        style={{
          fontSize: 12,
          fontWeight: 500,
          padding: "6px 14px",
          borderRadius: 8,
          background: "#ffffff",
          border: `1px solid ${COLOR.border}`,
          color: COLOR.textSecondary,
          cursor: "pointer",
        }}
      >
        {syncing ? "Syncing…" : "Sync"}
      </button>

      <button
        onClick={() => navigate("/intake")}
        style={{
          fontSize: 12,
          fontWeight: 500,
          padding: "6px 14px",
          borderRadius: 8,
          background: COLOR.blue,
          border: "none",
          color: "#ffffff",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        + New RFQ
      </button>
    </header>
  );
}

/* =========================================================================
   ZONE 1 — BUSINESS PULSE
   ========================================================================= */
function StatChip({ topBorder, label, value, valueColor, sub, linkLabel, linkTo }) {
  return (
    <div
      style={cardStyle({
        borderTop: `2px solid ${topBorder}`,
        padding: "8px 10px",
        height: 80,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minWidth: 0,
      })}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 8,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: COLOR.textMuted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 500, color: valueColor, lineHeight: 1.1 }}>{value}</p>
        {sub && <p style={{ margin: "1px 0 0", fontSize: 8, color: COLOR.textMuted }}>{sub}</p>}
      </div>
      <Link to={linkTo} style={{ fontSize: 8, color: COLOR.blue, textDecoration: "none" }}>
        {linkLabel} →
      </Link>
    </div>
  );
}

const phpFmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function BusinessPulseZone() {
  const { stats, loading } = useBusinessPulse();

  const rfqs = stats.rfqsUnanswered ?? 0;
  const pos = stats.posUndelivered ?? 0;
  const pending = stats.pendingPayment ?? 0;
  const completed = stats.completedThisYear ?? 0;

  return (
    <section>
      <SectionLabel tone="blue">Operations</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        <StatChip
          topBorder={COLOR.blue}
          label="RFQs unanswered"
          value={loading ? "—" : rfqs}
          valueColor={!loading && rfqs > 0 ? COLOR.red : COLOR.textPrimary}
          sub="awaiting reply"
          linkLabel="Pipeline"
          linkTo="/pipeline"
        />
        <StatChip
          topBorder={COLOR.blue}
          label="POs undelivered"
          value={loading ? "—" : pos}
          valueColor={!loading && pos > 0 ? COLOR.orange : COLOR.textPrimary}
          sub="in transit"
          linkLabel="Pipeline"
          linkTo="/pipeline"
        />
        <StatChip
          topBorder={COLOR.amber}
          label="Pending payment"
          value={loading ? "—" : phpFmt.format(pending)}
          valueColor={COLOR.amberDark}
          sub="outstanding"
          linkLabel="Ledger"
          linkTo="/ledger"
        />
        <StatChip
          topBorder={COLOR.green}
          label="Completed this year"
          value={loading ? "—" : completed}
          valueColor={COLOR.green}
          sub="RFQs won"
          linkLabel="History"
          linkTo="/wins"
        />
      </div>
    </section>
  );
}

/* =========================================================================
   ZONE 2 — WEEKLY PLAN
   ========================================================================= */
function WeeklyPlanZone({ todayISO, manilaDow, manila }) {
  // Monday–Friday of this work week, or next week if today is Sat/Sun.
  const weekStart = useMemo(() => {
    const diff = manilaDow === 0 ? 1 : manilaDow === 6 ? 2 : 1 - manilaDow;
    return new Date(manila.year, manila.month, manila.day + diff);
  }, [manila.year, manila.month, manila.day, manilaDow]);

  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekEnd = days[4];

  const { pipelineByDate, meetingEvents } = useWeekEvents(weekStart, weekEnd);

  return (
    <section>
      <SectionLabel tone="blue">This Week</SectionLabel>
      <div style={cardStyle({ padding: "7px 10px", maxHeight: 140, overflow: "hidden" })}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
          {days.map((d) => {
            const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
            const isToday = iso === todayISO;
            const dayEvents = pipelineByDate[iso] ?? [];
            const dayMeetings = meetingEvents.filter(
              (ev) => ev.start && isoOf(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate()) === iso
            );
            const chips = [
              ...dayEvents.map((ev) => ({ label: ev.label, variant: ev.variant })),
              ...dayMeetings.map((ev) => ({ label: ev.title, variant: "purple" })),
            ].slice(0, 2);

            return (
              <div key={iso} style={{ textAlign: "center", minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 7,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: COLOR.textMuted,
                  }}
                >
                  {WEEKDAY_SHORT[d.getDay()]}
                </p>
                {isToday ? (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: COLOR.blue,
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "1px auto 2px",
                    }}
                  >
                    {d.getDate()}
                  </div>
                ) : (
                  <p style={{ margin: "1px 0 2px", fontSize: 9, fontWeight: 500, color: COLOR.textSecondary }}>
                    {d.getDate()}
                  </p>
                )}
                {chips.length > 0 ? (
                  chips.map((chip, i) => {
                    const c = CHIP_COLORS[chip.variant] ?? CHIP_COLORS.blue;
                    return (
                      <div
                        key={i}
                        title={chip.label}
                        style={{
                          background: c.bg,
                          color: c.text,
                          borderRadius: 3,
                          padding: "2px 4px",
                          fontSize: 7,
                          marginBottom: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {chip.label}
                      </div>
                    );
                  })
                ) : (
                  <>
                    <div style={{ height: 9, background: COLOR.rowLine, borderRadius: 2, marginBottom: 1 }} />
                    <div style={{ height: 9, background: COLOR.rowLine, borderRadius: 2 }} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   ZONE 3 — FOCUS ENGINE
   ========================================================================= */
function ZoneCardHeader({ icon, title, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderBottom: `1px solid ${COLOR.headerLine}`,
      }}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: 500, color: COLOR.textPrimary, flex: 1, minWidth: 0 }}>{title}</span>
      {action}
    </div>
  );
}

function MitsCard() {
  const { todayLog, updateMits } = useCheckIn();
  const [mits, setMits] = useState(todayLog?.mits ?? []);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setMits(todayLog?.mits ?? []);
  }, [todayLog?.mits]);

  function persist(next) {
    setMits(next);
    updateMits(next).catch(() => {});
  }

  function toggle(i) {
    persist(mits.map((m, idx) => (idx === i ? { ...m, done: !m.done } : m)));
  }
  function remove(i) {
    persist(mits.filter((_, idx) => idx !== i));
  }
  function add(e) {
    e.preventDefault();
    if (!draft.trim() || mits.length >= 3) return;
    persist([...mits, { text: draft.trim(), done: false }]);
    setDraft("");
  }

  const TAG_STYLE = {
    urgent: { bg: "#fee2e2", text: "#991b1b", label: "Urgent" },
    today: { bg: COLOR.amberLight, text: COLOR.amberText, label: "Today" },
  };

  return (
    <div style={cardStyle({ display: "flex", flexDirection: "column", overflow: "hidden" })}>
      <ZoneCardHeader
        icon={<ListNumbersIcon style={{ width: 12, height: 12, color: COLOR.blue }} />}
        title={
          <>
            MITs today <span style={{ color: COLOR.textMuted, fontWeight: 400 }}>({mits.length}/3)</span>
          </>
        }
        action={
          <button
            onClick={() => setEditing((v) => !v)}
            style={{ fontSize: 9, color: COLOR.blue, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {editing ? "Done" : "Edit"}
          </button>
        }
      />
      <div>
        {mits.map((m, i) => {
          const tag = m.tag && TAG_STYLE[m.tag];
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                borderBottom: `1px solid ${COLOR.rowLine}`,
              }}
            >
              <button
                onClick={() => toggle(i)}
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  fontWeight: 500,
                  color: "#fff",
                  background: COLOR.blue,
                  opacity: m.done ? 0.45 : 1,
                }}
              >
                {m.done ? "✓" : i + 1}
              </button>
              <span
                style={{
                  fontSize: 10,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: m.done ? COLOR.textMuted : COLOR.textPrimary,
                  textDecoration: m.done ? "line-through" : "none",
                }}
              >
                {m.text}
              </span>
              {tag && (
                <span
                  style={{
                    fontSize: 7,
                    fontWeight: 500,
                    padding: "1px 5px",
                    borderRadius: 999,
                    background: tag.bg,
                    color: tag.text,
                    flexShrink: 0,
                  }}
                >
                  {tag.label}
                </span>
              )}
              {editing && (
                <button
                  onClick={() => remove(i)}
                  style={{ fontSize: 9, color: COLOR.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {editing && mits.length < 3 && (
          <form onSubmit={add} style={{ display: "flex", gap: 4, padding: "4px 10px" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a task…"
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 10,
                padding: "3px 6px",
                borderRadius: 3,
                border: `1px solid ${COLOR.border}`,
                background: COLOR.rowLine,
                color: COLOR.textPrimary,
              }}
            />
            <button
              type="submit"
              style={{ fontSize: 9, color: COLOR.blue, background: "none", border: "none", cursor: "pointer" }}
            >
              Add
            </button>
          </form>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          background: COLOR.fafafa,
          borderTop: `1px solid ${COLOR.headerLine}`,
        }}
      >
        <SparkleIcon style={{ width: 8, height: 8, color: COLOR.purple }} />
        <span style={{ fontSize: 8, color: COLOR.textMuted }}>Suggested by Claude</span>
      </div>
    </div>
  );
}

function LearningHubCompactCard() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopics()
      .then((data) => {
        const active = data.filter((t) => t.status === "active");
        const pick = [...active].sort((a, b) => {
          const aDone = loggedToday(a) ? 1 : 0;
          const bDone = loggedToday(b) ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return (b.current_streak ?? 0) - (a.current_streak ?? 0);
        })[0];
        setTopic(pick ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const doneToday = topic ? loggedToday(topic) : false;

  return (
    <div style={cardStyle({ overflow: "hidden" })}>
      <ZoneCardHeader
        icon={<BookIcon style={{ width: 12, height: 12, color: COLOR.blue }} />}
        title="Learning Hub"
        action={
          <button
            onClick={() => topic && navigate(`/learning-hub?topic=${topic.id}&log=1`)}
            disabled={!topic}
            style={{
              fontSize: 8,
              color: COLOR.blue,
              background: "none",
              border: "none",
              cursor: topic ? "pointer" : "default",
              padding: 0,
              opacity: topic ? 1 : 0.4,
            }}
          >
            Continue
          </button>
        }
      />
      <div style={{ padding: "8px 10px" }}>
        {loading ? (
          <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted }}>Loading…</p>
        ) : !topic ? (
          <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted }}>No active topics.</p>
        ) : doneToday ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLOR.green, flexShrink: 0 }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: COLOR.textPrimary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {topic.title}
            </span>
          </div>
        ) : (
          <>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 500,
                color: COLOR.textPrimary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {topic.title}
            </p>
            {topic.description && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 10,
                  fontStyle: "italic",
                  color: COLOR.textSecondary,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                “{topic.description}”
              </p>
            )}
            <div style={{ height: 4, background: COLOR.headerLine, borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
              <div style={{ height: "100%", width: `${topic.progress_percent ?? 0}%`, background: COLOR.blue }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <FlameIcon style={{ width: 9, height: 9, color: COLOR.orange }} />
              <span style={{ fontSize: 9, color: COLOR.textSecondary }}>{topic.current_streak ?? 0} day streak</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TimeBlocksCard() {
  const { todayLog } = useCheckIn();
  const [blocks, setBlocks] = useLocalStorage(`mc:timeblocks:${todayISODate()}`, []);
  const [adding, setAdding] = useState(false);
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");

  function nowHHMM() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  const nowStr = nowHHMM();

  function addBlock(e) {
    e.preventDefault();
    if (!time || !label.trim()) return;
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), time, label: label.trim() }].sort((a, b) => a.time.localeCompare(b.time)));
    setTime("");
    setLabel("");
    setAdding(false);
  }

  // --- Pomodoro (self-contained, local state) ---
  const FOCUS_SECONDS = 25 * 60;
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [sessionCount, setSessionCount] = useLocalStorage(`mc:pomodoro-sessions:${todayISODate()}`, 0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          setSessionCount((n) => n + 1);
          return FOCUS_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const mm = pad2(Math.floor(secondsLeft / 60));
  const ss = pad2(secondsLeft % 60);
  const firstMit = todayLog?.mits?.[0]?.text ?? "No MIT set";
  const streak = Number(window?.localStorage?.getItem?.(`mc:pomodoro-streak`)) || 0;

  // --- Shutdown ritual (two free-text fields + a save button) ---
  const [shutdown, setShutdown] = useLocalStorage(`mc:shutdown:${todayISODate()}`, { top: "", note: "" });
  const [shutdownSaved, setShutdownSaved] = useState(false);

  return (
    <div style={cardStyle({ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" })}>
      <ZoneCardHeader
        icon={<ClockIcon style={{ width: 12, height: 12, color: COLOR.textMuted }} />}
        title="Time blocks"
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            style={{ fontSize: 9, color: COLOR.blue, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            + Add
          </button>
        }
      />

      <div style={{ maxHeight: 130, overflowY: "auto" }}>
        {blocks.length === 0 && !adding && (
          <p style={{ margin: 0, fontSize: 9, color: COLOR.textMuted, padding: "6px 10px" }}>No blocks yet today.</p>
        )}
        {blocks.map((b, i) => {
          const next = blocks[i + 1];
          const isActive = b.time <= nowStr && (!next || nowStr < next.time);
          return (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "3px 10px",
                borderBottom: `1px solid ${COLOR.rowLine}`,
                background: isActive ? COLOR.blueLight : "transparent",
              }}
            >
              <span style={{ fontSize: 8, minWidth: 26, color: isActive ? COLOR.blue : COLOR.textMuted }}>{b.time}</span>
              <span
                style={{
                  fontSize: 9,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: isActive ? COLOR.blueDark : COLOR.textPrimary,
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {b.label}
              </span>
              {isActive && (
                <span
                  style={{
                    fontSize: 7,
                    padding: "1px 5px",
                    borderRadius: 999,
                    background: COLOR.blue,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  Now
                </span>
              )}
            </div>
          );
        })}
        {adding && (
          <form onSubmit={addBlock} style={{ display: "flex", gap: 4, padding: "4px 10px" }}>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ fontSize: 8, padding: "3px 4px", borderRadius: 3, border: `1px solid ${COLOR.border}`, width: 70 }}
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label…"
              style={{ flex: 1, minWidth: 0, fontSize: 9, padding: "3px 6px", borderRadius: 3, border: `1px solid ${COLOR.border}` }}
            />
            <button type="submit" style={{ fontSize: 9, color: COLOR.blue, background: "none", border: "none", cursor: "pointer" }}>
              Add
            </button>
          </form>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Pomodoro bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          background: COLOR.fafafa,
          borderTop: `1px solid ${COLOR.headerLine}`,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: `2px solid ${COLOR.purple}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 600, color: COLOR.purple }}>{mm}:{ss}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              color: COLOR.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            MIT 1 · {firstMit}
          </p>
          <p style={{ margin: 0, fontSize: 7, color: COLOR.textMuted }}>
            Session {sessionCount + 1} of 4 · streak {streak}
          </p>
        </div>
        <button
          onClick={() => setRunning((r) => !r)}
          style={{
            fontSize: 8,
            fontWeight: 500,
            padding: "3px 8px",
            borderRadius: 3,
            border: "none",
            background: COLOR.purple,
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {running ? "Pause" : "Start"}
        </button>
      </div>

      {/* Shutdown bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderTop: `1px solid ${COLOR.headerLine}`,
        }}
      >
        <input
          value={shutdown.top}
          onChange={(e) => {
            setShutdown((s) => ({ ...s, top: e.target.value }));
            setShutdownSaved(false);
          }}
          placeholder="Tomorrow's #1…"
          style={{
            flex: 1,
            minWidth: 0,
            background: COLOR.rowLine,
            border: `1px solid ${COLOR.border}`,
            borderRadius: 3,
            padding: "3px 6px",
            fontSize: 8,
            color: COLOR.textMuted,
          }}
        />
        <input
          value={shutdown.note}
          onChange={(e) => {
            setShutdown((s) => ({ ...s, note: e.target.value }));
            setShutdownSaved(false);
          }}
          placeholder="Note…"
          style={{
            flex: 1,
            minWidth: 0,
            background: COLOR.rowLine,
            border: `1px solid ${COLOR.border}`,
            borderRadius: 3,
            padding: "3px 6px",
            fontSize: 8,
            color: COLOR.textMuted,
          }}
        />
        <button
          onClick={() => setShutdownSaved(true)}
          style={{
            fontSize: 8,
            fontWeight: 500,
            padding: "3px 8px",
            borderRadius: 3,
            border: "none",
            background: COLOR.green,
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {shutdownSaved ? "Saved ✓" : "Shutdown"}
        </button>
      </div>
    </div>
  );
}

function FocusEngineZone() {
  return (
    <section>
      <SectionLabel tone="blue">Today</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <MitsCard />
          <LearningHubCompactCard />
        </div>
        <TimeBlocksCard />
      </div>
    </section>
  );
}

/* =========================================================================
   ZONE 4 — GROWTH LAYER
   ========================================================================= */
function PriorityBadge({ priority }) {
  const map = {
    Hot: { bg: "#fee2e2", text: "#991b1b" },
    Medium: { bg: COLOR.amberLight, text: COLOR.amberText },
    Low: { bg: COLOR.headerLine, text: COLOR.textSecondary },
    Nurturing: { bg: COLOR.headerLine, text: COLOR.textSecondary },
  };
  const s = map[priority] ?? map.Low;
  return (
    <span style={{ fontSize: 7, fontWeight: 500, padding: "1px 5px", borderRadius: 999, background: s.bg, color: s.text, flexShrink: 0 }}>
      {priority}
    </span>
  );
}
const PRIORITY_DOT = { Hot: COLOR.red, Medium: COLOR.amber, Low: COLOR.textMuted, Nurturing: COLOR.textMuted };

function CrosshairsCard() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTargets()
      .then(setTargets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={cardStyle({ overflow: "hidden" })}>
      <ZoneCardHeader
        icon={<CrosshairsIcon style={{ width: 12, height: 12, color: COLOR.purple }} />}
        title="Crosshairs"
        action={
          <Link to="/crosshairs" style={{ fontSize: 9, color: COLOR.purple, textDecoration: "none" }}>
            + Add
          </Link>
        }
      />
      <div>
        {!loading && targets.length === 0 && (
          <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted, padding: "8px 10px" }}>No targets yet.</p>
        )}
        {targets.slice(0, 4).map((t) => (
          <div
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderBottom: `1px solid ${COLOR.rowLine}` }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: PRIORITY_DOT[t.priority] ?? COLOR.textMuted, flexShrink: 0 }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: COLOR.textPrimary,
              }}
            >
              {t.target_name}
            </span>
            <PriorityBadge priority={t.priority} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BacklogCard() {
  const { tasks } = useClickUpTasks();
  const staleCount = tasks.filter((t) => t.isStale).length;

  function ageColor(days) {
    if (days === null) return COLOR.textMuted;
    if (days > 14) return COLOR.red;
    if (days >= 7) return COLOR.amber;
    return COLOR.textMuted;
  }

  return (
    <div style={cardStyle({ overflow: "hidden" })}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderBottom: `1px solid ${COLOR.headerLine}`,
        }}
      >
        <StackIcon style={{ width: 12, height: 12, color: COLOR.textSecondary }} />
        <span style={{ fontSize: 10, fontWeight: 500, color: COLOR.textPrimary, flex: 1, minWidth: 0 }}>Backlog</span>
        {staleCount > 0 && (
          <span style={{ fontSize: 7, fontWeight: 500, padding: "1px 5px", borderRadius: 999, background: "#fee2e2", color: "#991b1b" }}>
            {staleCount} stale
          </span>
        )}
        <a
          href={`https://app.clickup.com/${CLICKUP_WORKSPACE_ID}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 9, color: COLOR.blue, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          ClickUp ↗
        </a>
      </div>
      <div>
        {tasks.length === 0 && <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted, padding: "8px 10px" }}>No open tasks.</p>}
        {tasks.slice(0, 4).map((t) => (
          <div
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderBottom: `1px solid ${COLOR.rowLine}` }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: COLOR.blue, flexShrink: 0 }} />
            <span
              style={{
                fontSize: 10,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: COLOR.textPrimary,
              }}
            >
              {t.name}
            </span>
            <span style={{ fontSize: 9, color: ageColor(t.daysSinceActivity), flexShrink: 0 }}>
              {t.daysSinceActivity === null ? "—" : `${t.daysSinceActivity}d`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const BREWING_STATUS_STYLE = {
  Active: { bg: COLOR.greenLight, text: COLOR.greenText },
  Planning: { bg: "#dbeafe", text: COLOR.blueDark },
  Draft: { bg: COLOR.headerLine, text: COLOR.textSecondary },
  Scheduled: { bg: "#ede9fe", text: COLOR.purpleDark },
  Idea: { bg: COLOR.amberLight, text: COLOR.amberText },
};
const BREWING_DOT = {
  Active: COLOR.green,
  Planning: COLOR.blue,
  Draft: COLOR.textMuted,
  Scheduled: COLOR.purple,
  Idea: COLOR.amber,
};

function BrewingCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");

  function load() {
    fetchBrewingItems({ limit: 4 })
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function quickAdd(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    try {
      await createBrewingItem({ name: draft.trim() });
      setDraft("");
      load();
    } catch {
      // best-effort — the full Brewing page is always available
    }
  }

  return (
    <div style={cardStyle({ overflow: "hidden", display: "flex", flexDirection: "column" })}>
      <ZoneCardHeader
        icon={<FlameIcon style={{ width: 11, height: 11, color: COLOR.purple }} />}
        title="Brewing"
        action={
          <Link to="/brewing" style={{ fontSize: 9, color: COLOR.purple, textDecoration: "none" }}>
            + Add
          </Link>
        }
      />
      <div>
        {!loading && items.length === 0 && (
          <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted, padding: "8px 10px" }}>Nothing here.</p>
        )}
        {items.map((item) => {
          const s = BREWING_STATUS_STYLE[item.status] ?? BREWING_STATUS_STYLE.Draft;
          return (
            <div
              key={item.id}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderBottom: `1px solid ${COLOR.rowLine}` }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: BREWING_DOT[item.status] ?? COLOR.textMuted, flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: COLOR.textPrimary,
                }}
              >
                {item.name}
              </span>
              <span style={{ fontSize: 7, fontWeight: 500, padding: "1px 5px", borderRadius: 999, background: s.bg, color: s.text, flexShrink: 0 }}>
                {item.status}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <form onSubmit={quickAdd} style={{ display: "flex", gap: 4, padding: "4px 10px", borderTop: `1px solid ${COLOR.headerLine}` }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="An idea still forming…"
          style={{ flex: 1, minWidth: 0, fontSize: 9, padding: "3px 6px", borderRadius: 3, border: `1px solid ${COLOR.border}`, color: COLOR.textPrimary }}
        />
        <button type="submit" style={{ fontSize: 9, color: COLOR.purple, background: "none", border: "none", cursor: "pointer" }}>
          Add
        </button>
      </form>
    </div>
  );
}

function GrowthLayerZone() {
  return (
    <section>
      <SectionLabel tone="purple">Growth</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, alignItems: "start" }}>
        <CrosshairsCard />
        <BacklogCard />
        <BrewingCard />
      </div>
    </section>
  );
}

/* =========================================================================
   ZONE 5 — MONTH CALENDAR
   ========================================================================= */
const LEGEND = [
  { label: "RFQ", color: COLOR.amber },
  { label: "Delivery", color: COLOR.green },
  { label: "Invoice", color: COLOR.blue },
  { label: "Meeting", color: COLOR.purple },
];

function MonthCalendarZone({ todayISO, manila }) {
  const [cursor, setCursor] = useState({ year: manila.year, month: manila.month });
  const { eventsByDate } = useMonthEvents(cursor.year, cursor.month);

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const totalDays = daysInMonth(cursor.year, cursor.month);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  function shiftMonth(delta) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <section>
      <SectionLabel tone="blue">Overview</SectionLabel>
      <div style={cardStyle({ padding: "7px 10px" })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
          <button
            onClick={() => shiftMonth(-1)}
            style={{ background: "none", border: "none", cursor: "pointer", color: COLOR.textSecondary, display: "flex" }}
          >
            <ChevronLeftIcon style={{ width: 12, height: 12 }} />
          </button>
          <span style={{ fontSize: 10, fontWeight: 500, color: COLOR.textPrimary, width: 120, textAlign: "center" }}>
            {monthLabel}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            style={{ background: "none", border: "none", cursor: "pointer", color: COLOR.textSecondary, display: "flex", transform: "rotate(180deg)" }}
          >
            <ChevronLeftIcon style={{ width: 12, height: 12 }} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div key={w} style={{ textAlign: "center", fontSize: 6, textTransform: "uppercase", color: COLOR.textMuted, paddingBottom: 3 }}>
              {w}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} />;
            const iso = isoOf(cursor.year, cursor.month, day);
            const isToday = iso === todayISO;
            const events = eventsByDate[iso] ?? [];
            return (
              <div key={iso} style={{ textAlign: "center", padding: "3px 0" }}>
                {isToday ? (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: COLOR.blue,
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto",
                    }}
                  >
                    {day}
                  </div>
                ) : (
                  <span style={{ fontSize: 8, color: COLOR.textPrimary }}>{day}</span>
                )}
                <div style={{ display: "flex", justifyContent: "center", gap: 1, marginTop: 2, height: 3 }}>
                  {events.slice(0, 3).map((ev, i) => (
                    <span
                      key={i}
                      title={ev.label}
                      style={{ width: 3, height: 3, borderRadius: "50%", background: DOT_SOLID[ev.variant] ?? COLOR.blue }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 6, paddingTop: 5, borderTop: `1px solid ${COLOR.headerLine}` }}>
          {LEGEND.map((l) => (
            <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7, color: COLOR.textSecondary }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
