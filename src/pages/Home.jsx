import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import homeCss from "./Home.css?raw";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useCheckIn } from "../lib/CheckInContext";
import { todayISODate } from "../lib/dateUtils";
import { fetchTopics as fetchLearningTopics, loggedToday } from "../lib/learningHub";
import { fetchTargets } from "../lib/crosshairs";
import { fetchOkrs } from "../lib/okrs";
import { fetchBrewingItems } from "../lib/brewing";
import { useClickUpTasks } from "../lib/useClickUpTasks";
import { CLICKUP_WORKSPACE_ID } from "../lib/clickup";
import { listEvents, isGoogleCalendarConfigured } from "../lib/googleCalendar";
import { useLocalStorage } from "../lib/useLocalStorage";

/* =============================================================================
   This page is a direct port of the approved HTML/CSS reference
   (mission-control-homepage.html). Every class name, pixel value, and DOM
   shape below matches that file exactly — src/pages/Home.css is a verbatim
   copy of its <style> block, injected as a real <style> tag scoped to this
   component's lifetime (mounted/unmounted by React along with the page,
   so it never leaks onto any other route). No Tailwind, no shared
   src/components/ui/* library, no shared Sidebar/TopBar/Layout — this file
   renders 100% of its own markup, exactly like the previous self-contained
   homepage session, per Task 2.
   ============================================================================= */

// ---------------------------------------------------------------------------
// Date helpers — ported 1:1 from the reference's <script> block.
// ---------------------------------------------------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getManilaDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function getWeekDates() {
  const d = getManilaDate();
  const day = d.getDay(); // 0=Sun..6=Sat
  const sun = new Date(d);
  sun.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sun);
    dd.setDate(sun.getDate() + i);
    return dd;
  });
}

const EVENT_CLASS = { rfq: "ev-rfq", del: "ev-del", mtg: "ev-mtg", adm: "ev-adm" };
const POM_TOTAL = 25 * 60;

// ---------------------------------------------------------------------------
// Zone reorder — the five homepage zones can be dragged into any order.
// The order is persisted to localStorage so it survives a reload.
// ---------------------------------------------------------------------------
const DEFAULT_ZONE_ORDER = ["pulse", "weekly", "focus", "growth", "calendar"];
const ZONE_ORDER_KEY = "mc_zone_order";

function loadZoneOrder() {
  try {
    const raw = localStorage.getItem(ZONE_ORDER_KEY);
    if (!raw) return DEFAULT_ZONE_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ZONE_ORDER;
    const valid = parsed.filter((id) => DEFAULT_ZONE_ORDER.includes(id));
    const missing = DEFAULT_ZONE_ORDER.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_ZONE_ORDER;
  }
}

const zoneHandle = (
  <span className="zone-handle" aria-hidden="true">
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
  </span>
);

export default function Home() {
  return (
    <>
      <style>{homeCss}</style>
      <HomeInner />
    </>
  );
}

function HomeInner() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { todayLog, isComplete, submit, updateMits } = useCheckIn();

  /* ------------------------------ MITs ------------------------------ */
  const mits = todayLog?.mits ?? [];
  function persistMits(next) {
    updateMits(next).catch(() => {});
  }
  function removeMIT(i) {
    persistMits(mits.filter((_, idx) => idx !== i));
  }
  function addMitOrHitlist(text) {
    if (mits.length < 3) {
      persistMits([...mits, text]);
    } else {
      setHitlistOverlay((prev) => [{ label: text, age: 0, stale: false, source: "local" }, ...prev]);
    }
  }

  /* --------------------------- New task bar --------------------------- */
  const [newTask, setNewTask] = useState("");
  async function addNewTask() {
    const v = newTask.trim();
    if (!v) return;
    setNewTask("");

    const goingToMits = mits.length < 3;
    addMitOrHitlist(v);

    // Best-effort persistence to work_items — this table doesn't exist in
    // the current schema (verified against supabase/migrations/*.sql), so
    // this always falls through to the console.warn fallback per Task 8.
    try {
      const { error } = await supabase.from("work_items").insert({
        type: "task",
        title: v,
        mit_date: goingToMits ? todayISODate() : null,
        area_id: await getSystemsAreaId(),
      });
      if (error) throw error;
    } catch (err) {
      console.warn(
        "work_items table is not available in this Supabase project — new task kept in local state only.",
        err?.message ?? err
      );
    }
  }

  /* --------------------------- Hitlist (ClickUp) --------------------------- */
  const { tasks: clickupTasks } = useClickUpTasks();
  const [hitlistOverlay, setHitlistOverlay] = useState([]); // client-only additions (demoted MITs, new tasks over the cap)
  const [hiddenHitlistKeys, setHiddenHitlistKeys] = useState(() => new Set());

  const hitlist = useMemo(() => {
    const real = clickupTasks
      .filter((t) => !hiddenHitlistKeys.has(t.id))
      .map((t) => ({
        key: t.id,
        label: t.name,
        age: t.daysSinceActivity ?? 0,
        stale: t.isStale,
      }));
    return [...hitlistOverlay.map((h, i) => ({ key: `local-${i}-${h.label}`, ...h })), ...real];
  }, [clickupTasks, hiddenHitlistKeys, hitlistOverlay]);

  const staleCount = hitlist.filter((t) => t.stale).length;

  function demoteMitToHitlist(label, mitIndex) {
    setHitlistOverlay((prev) => [{ label, age: 0, stale: false }, ...prev]);
    persistMits(mits.filter((_, idx) => idx !== mitIndex));
  }

  /* --------------------------- Time blocks --------------------------- */
  const [blocks, setBlocks] = useLocalStorage(`mc:v3:timeblocks:${todayISODate()}`, []);
  const [tbTime, setTbTime] = useState("09:00");
  const [tbLabel, setTbLabel] = useState("");

  function addTimeBlock(time, label) {
    if (!time || !label) return;
    setBlocks((prev) => [...prev, { time, label }].sort((a, b) => a.time.localeCompare(b.time)));
  }
  function nextHalfHourManila() {
    const now = getManilaDate();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String((Math.ceil(now.getMinutes() / 30) * 30) % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  /* --------------------------- Learning Hub --------------------------- */
  const [topic, setTopic] = useState(null);
  const [topicLoading, setTopicLoading] = useState(true);
  useEffect(() => {
    fetchLearningTopics()
      .then((rows) => {
        const active = rows.filter((r) => r.status === "active");
        const mostRecent = [...active].sort(
          (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0)
        )[0];
        setTopic(mostRecent ?? null);
      })
      .catch(() => {})
      .finally(() => setTopicLoading(false));
  }, []);
  const topicDoneToday = topic ? loggedToday(topic) : false;

  /* --------------------------- Pomodoro --------------------------- */
  const [pomSeconds, setPomSeconds] = useState(POM_TOTAL);
  const [pomRunning, setPomRunning] = useState(false);
  const pomIntervalRef = useRef(null);

  useEffect(() => {
    if (!pomRunning) return;
    pomIntervalRef.current = setInterval(() => {
      setPomSeconds((s) => {
        if (s <= 1) {
          setPomRunning(false);
          return POM_TOTAL;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(pomIntervalRef.current);
  }, [pomRunning]);

  function togglePom() {
    setPomRunning((r) => !r);
  }
  function resetPom() {
    clearInterval(pomIntervalRef.current);
    setPomRunning(false);
    setPomSeconds(POM_TOTAL);
  }
  function openLofi() {
    window.open("https://www.youtube.com/watch?v=jfKfPfyJRdk", "_blank");
  }
  const pomMin = String(Math.floor(pomSeconds / 60)).padStart(2, "0");
  const pomSec = String(pomSeconds % 60).padStart(2, "0");
  const pomCirc = 100;
  const pomPct = (pomSeconds / POM_TOTAL) * pomCirc;

  /* --------------------------- Shutdown ritual --------------------------- */
  const SHUT_ITEMS = ["Inbox zero", "Tomorrow's MITs set", "Desk cleared", "Wins logged", "Calendar checked"];
  const [shutChecked, setShutChecked] = useLocalStorage(`mc:v3:shutdown:${todayISODate()}`, {});
  const shutDone = SHUT_ITEMS.filter((i) => shutChecked[i]).length;
  function toggleShut(item) {
    setShutChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  }

  /* --------------------------- Business pulse --------------------------- */
  const [pulse, setPulse] = useState({ rfqs: null, pos: null, pending: null, completed: null });
  useEffect(() => {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const yearEnd = `${new Date().getFullYear()}-12-31`;
    Promise.all([
      supabase.from("rfqs").select("id", { count: "exact", head: true }).in("status", ["intake_confirmed", "sourced"]),
      supabase.from("purchase_orders").select("id", { count: "exact", head: true }).neq("status", "delivered"),
      supabase.from("invoices").select("amount").neq("status", "paid"),
      supabase
        .from("rfqs")
        .select("id", { count: "exact", head: true })
        .eq("status", "delivered")
        .gte("created_at", yearStart)
        .lte("created_at", `${yearEnd}T23:59:59`),
    ]).then(([rfqs, pos, invoices, completed]) => {
      setPulse({
        rfqs: rfqs.count ?? 0,
        pos: pos.count ?? 0,
        pending: (invoices.data ?? []).reduce((sum, i) => sum + Number(i.amount ?? 0), 0),
        completed: completed.count ?? 0,
      });
    });
  }, []);

  /* --------------------------- Crosshairs (growth layer) --------------------------- */
  const [crosshairs, setCrosshairs] = useState([]);
  useEffect(() => {
    fetchTargets().then(setCrosshairs).catch(() => {});
  }, []);

  /* --------------------------- Brewing --------------------------- */
  const [brewing, setBrewing] = useState([]);
  useEffect(() => {
    fetchBrewingItems({ limit: 5 }).then(setBrewing).catch(() => {});
  }, []);

  /* --------------------------- Weekly plan + real events --------------------------- */
  const weekDays = useMemo(() => getWeekDates(), []);
  const weekStartISO = isoDate(weekDays[0]);
  const weekEndISO = isoDate(weekDays[6]);
  const [weekEvents, setWeekEvents] = useState({}); // { iso: [{t,l}] } from real Supabase + Google Calendar
  const [localWeekEvents, setLocalWeekEvents] = useState({}); // drag-drop additions, client-only
  const [calendarError, setCalendarError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const map = {};
      const [rfqs, deliveries, invoices] = await Promise.all([
        supabase.from("rfqs").select("id, closing_date").gte("closing_date", weekStartISO).lte("closing_date", weekEndISO),
        supabase
          .from("deliveries")
          .select("id, delivery_date")
          .gte("delivery_date", weekStartISO)
          .lte("delivery_date", weekEndISO),
        supabase.from("invoices").select("id, due_date").gte("due_date", weekStartISO).lte("due_date", weekEndISO),
      ]);
      (rfqs.data ?? []).forEach((r) => {
        (map[r.closing_date] ??= []).push({ t: "rfq", l: "RFQ closing" });
      });
      (deliveries.data ?? []).forEach((d) => {
        (map[d.delivery_date] ??= []).push({ t: "del", l: "Delivery" });
      });
      (invoices.data ?? []).forEach((i) => {
        (map[i.due_date] ??= []).push({ t: "adm", l: "Invoice due" });
      });

      if (isGoogleCalendarConfigured()) {
        const timeMin = new Date(`${weekStartISO}T00:00:00`);
        const timeMax = new Date(`${weekEndISO}T23:59:59`);
        const { events, error } = await listEvents({ timeMin, timeMax });
        if (error) setCalendarError(error);
        events.forEach((ev) => {
          if (!ev.start) return;
          const key = isoDate(ev.start);
          (map[key] ??= []).push({ t: "mtg", l: ev.title });
        });
      }

      if (!cancelled) setWeekEvents(map);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [weekStartISO, weekEndISO]);

  function mergedEventsFor(iso) {
    return [...(weekEvents[iso] ?? []), ...(localWeekEvents[iso] ?? [])];
  }
  function dropOnDay(iso, label) {
    if (!label) return;
    setLocalWeekEvents((prev) => ({ ...prev, [iso]: [...(prev[iso] ?? []), { t: "adm", l: label }] }));
  }

  const weekLabel = `Weekly plan — ${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} to ${weekDays[6].getDate()} ${
    MONTHS[weekDays[6].getMonth()]
  }`;

  /* --------------------------- Month calendar --------------------------- */
  const manilaToday = getManilaDate();
  const todayStr = isoDate(manilaToday);
  const [calCursor, setCalCursor] = useState({ year: manilaToday.getFullYear(), month: manilaToday.getMonth() });
  const [calDots, setCalDots] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const monthStart = new Date(calCursor.year, calCursor.month, 1);
      const monthEnd = new Date(calCursor.year, calCursor.month + 1, 0);
      const startISO = isoDate(monthStart);
      const endISO = isoDate(monthEnd);
      const dots = {};
      const add = (dateStr, color) => {
        if (!dateStr) return;
        (dots[dateStr] ??= []).push(color);
      };

      const [rfqs, deliveries, invoices] = await Promise.all([
        supabase.from("rfqs").select("closing_date").gte("closing_date", startISO).lte("closing_date", endISO),
        supabase.from("deliveries").select("delivery_date").gte("delivery_date", startISO).lte("delivery_date", endISO),
        supabase.from("invoices").select("due_date").gte("due_date", startISO).lte("due_date", endISO),
      ]);
      (rfqs.data ?? []).forEach((r) => add(r.closing_date, "amber"));
      (deliveries.data ?? []).forEach((d) => add(d.delivery_date, "green"));
      (invoices.data ?? []).forEach((i) => add(i.due_date, "blue"));

      if (isGoogleCalendarConfigured()) {
        const { events } = await listEvents({
          timeMin: new Date(`${startISO}T00:00:00`),
          timeMax: new Date(`${endISO}T23:59:59`),
        });
        events.forEach((ev) => ev.start && add(isoDate(ev.start), "purple"));
      }

      if (!cancelled) setCalDots(dots);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [calCursor]);

  function shiftMonth(delta) {
    setCalCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }
  const calMonthLabel = new Date(calCursor.year, calCursor.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const calFirstWeekday = new Date(calCursor.year, calCursor.month, 1).getDay();
  const calDaysInMonth = new Date(calCursor.year, calCursor.month + 1, 0).getDate();

  /* --------------------------- Drag & drop plumbing --------------------------- */
  function dragMitStart(e, label) {
    e.dataTransfer.setData("text", label);
    e.dataTransfer.setData("source", "mit");
  }
  function dragHitlistStart(e, label) {
    e.dataTransfer.setData("text", label);
    e.dataTransfer.setData("source", "hitlist");
  }

  function onMitDrop(e) {
    e.preventDefault();
    const label = e.dataTransfer.getData("text");
    const source = e.dataTransfer.getData("source");
    if (source === "hitlist" && label && mits.length < 3 && !mits.includes(label)) {
      persistMits([...mits, label]);
      setHiddenHitlistKeys((prev) => new Set(prev)); // hitlist item stays visible — reference doesn't remove it either
      setHitlistOverlay((prev) => prev.filter((h) => h.label !== label));
    }
  }

  function onTimeBlocksDrop(e) {
    e.preventDefault();
    const label = e.dataTransfer.getData("text");
    const source = e.dataTransfer.getData("source");
    if (!label) return;
    if (source === "mit") {
      const idx = mits.indexOf(label);
      if (idx > -1) persistMits(mits.filter((_, i) => i !== idx));
    }
    addTimeBlock(nextHalfHourManila(), label);
  }

  function onHitlistDrop(e) {
    e.preventDefault();
    const label = e.dataTransfer.getData("text");
    const source = e.dataTransfer.getData("source");
    if (source === "mit" && label) {
      const idx = mits.indexOf(label);
      if (idx > -1) demoteMitToHitlist(label, idx);
    }
  }

  /* --------------------------- Morning ritual --------------------------- */
  const [ritualDismissed, setRitualDismissed] = useState(false);
  const showRitual = !isComplete && !ritualDismissed;
  const [mmStep, setMmStep] = useState(1); // 1..5, then "done"
  const [chip, setChip] = useState(null);
  const [energyIdx, setEnergyIdx] = useState(null);
  const [gratitude, setGratitude] = useState("");
  const [hottestTarget, setHottestTarget] = useState(null);
  const [seoOkr, setSeoOkr] = useState(null);

  useEffect(() => {
    if (!showRitual) return;
    fetchTargets()
      .then((rows) => setHottestTarget(rows.find((t) => t.priority === "Hot") ?? rows[0] ?? null))
      .catch(() => {});
    fetchOkrs()
      .then((rows) => setSeoOkr(rows.find((o) => o.objective?.toLowerCase().includes("seo")) ?? null))
      .catch(() => {});
  }, [showRitual]);

  function nextStep() {
    if (mmStep === 5) {
      setMmStep("done");
      return;
    }
    setMmStep((s) => s + 1);
  }
  async function unlockMorning() {
    try {
      await submit({
        energyLevel: energyIdx === null ? null : energyIdx + 1,
        feeling: chip,
        gratitude,
        mits,
      });
    } catch {
      // best-effort — the ritual still closes for this session either way
    }
    setRitualDismissed(true);
  }
  function skipMorning() {
    setRitualDismissed(true);
  }

  const seoPct = seoOkr?.target_number ? Math.round((Number(seoOkr.current_count) / Number(seoOkr.target_number)) * 100) : 0;

  /* --------------------------- Zone reorder (drag & drop) --------------------------- */
  const [zoneOrder, setZoneOrder] = useState(loadZoneOrder);
  const [draggedZone, setDraggedZone] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function handleZoneDragStart(e, zoneId) {
    setDraggedZone(zoneId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", zoneId);
  }
  function handleZoneDragOver(e, index) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    setDragOverIndex(before ? index : index + 1);
  }
  function handleZoneDrop(e) {
    e.preventDefault();
    setZoneOrder((prev) => {
      if (draggedZone == null || dragOverIndex == null) return prev;
      const fromIndex = prev.indexOf(draggedZone);
      if (fromIndex === -1) return prev;
      const withoutDragged = prev.filter((id) => id !== draggedZone);
      let insertAt = dragOverIndex;
      if (fromIndex < dragOverIndex) insertAt -= 1;
      const next = [...withoutDragged];
      next.splice(insertAt, 0, draggedZone);
      try {
        localStorage.setItem(ZONE_ORDER_KEY, JSON.stringify(next));
      } catch {
        // best-effort persistence only
      }
      return next;
    });
    setDraggedZone(null);
    setDragOverIndex(null);
  }
  function handleZoneDragEnd() {
    setDraggedZone(null);
    setDragOverIndex(null);
  }

  const zoneContent = {
    pulse: (
      <>
        <div className="zlbl">
          {zoneHandle}
          Business pulse
        </div>
        <div className="pulse">
          <div className="stat" style={{ borderTop: "2px solid var(--blue)" }} onClick={() => navigate("/pipeline")}>
            <div className="stat-lbl">RFQs unanswered</div>
            <div className="stat-n" style={{ color: pulse.rfqs > 0 ? "var(--red)" : "var(--t1)" }}>
              {pulse.rfqs ?? "—"}
            </div>
            <div className="stat-lnk">↗ Pipeline</div>
          </div>
          <div className="stat" style={{ borderTop: "2px solid var(--blue)" }} onClick={() => navigate("/pipeline")}>
            <div className="stat-lbl">POs undelivered</div>
            <div className="stat-n" style={{ color: pulse.pos > 0 ? "var(--orange)" : "var(--t1)" }}>
              {pulse.pos ?? "—"}
            </div>
            <div className="stat-lnk">↗ Pipeline</div>
          </div>
          <div className="stat" style={{ borderTop: "2px solid var(--amber)" }} onClick={() => navigate("/ledger")}>
            <div className="stat-lbl">Pending payment</div>
            <div className="stat-n" style={{ color: "var(--amber)" }}>
              {pulse.pending === null ? "—" : formatPhp(pulse.pending)}
            </div>
            <div className="stat-lnk am">↗ Ledger</div>
          </div>
          <div className="stat" style={{ borderTop: "2px solid var(--green)" }} onClick={() => navigate("/wins")}>
            <div className="stat-lbl">Completed this year</div>
            <div className="stat-n" style={{ color: "var(--green)" }}>
              {pulse.completed ?? "—"}
            </div>
            <div className="stat-lnk gr">↗ History</div>
          </div>
        </div>
      </>
    ),
    weekly: (
      <>
        <div className="zlbl">
          {zoneHandle}
          {weekLabel}
        </div>
        {calendarError && <p style={{ fontSize: 9, color: "var(--orange)", marginBottom: 4 }}>{calendarError}</p>}
        <div className="card">
          <div className="week-grid">
            {weekDays.map((d) => {
              const iso = isoDate(d);
              const isToday = iso === todayStr;
              const evs = mergedEventsFor(iso);
              return (
                <div
                  key={iso}
                  className="wday"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("drag-over-day");
                  }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("drag-over-day")}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("drag-over-day");
                    dropOnDay(iso, e.dataTransfer.getData("text"));
                  }}
                >
                  <div className="wd-n">{DAYNAMES[d.getDay()]}</div>
                  {isToday ? <div className="wd-tod">{d.getDate()}</div> : <div className="wd-d">{d.getDate()}</div>}
                  {evs.length > 0 ? (
                    evs.map((ev, i) => (
                      <div key={i} className={`ev ${EVENT_CLASS[ev.t]}`}>
                        {ev.l}
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="ev-emp" />
                      <div className="ev-emp" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </>
    ),
    focus: (
      <>
        <div className="zlbl">
          {zoneHandle}
          Focus engine
        </div>
        <div className="focus-grid">
          <div className="focus-left">
            {/* MITs */}
            <div className="card">
              <div className="ch">
                <span className="ch-t">
                  <svg viewBox="0 0 24 24">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                  </svg>
                  MITs today <span style={{ color: "var(--t3)", fontWeight: 400 }}>({mits.length}/3)</span>
                </span>
                <span className="ch-a" style={{ fontSize: 11, color: "var(--t3)" }}>
                  drag to schedule →
                </span>
              </div>
              <div
                className="mit-drop"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("drag-over-list");
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove("drag-over-list")}
                onDrop={(e) => {
                  e.currentTarget.classList.remove("drag-over-list");
                  onMitDrop(e);
                }}
              >
                {mits.length === 0 && <div className="mit-empty">No MITs yet. Use + New task above.</div>}
                {mits.map((m, i) => (
                  <div key={i} className="mit-row" draggable onDragStart={(e) => dragMitStart(e, m)}>
                    <div className="mit-n">{i + 1}</div>
                    <div className="mit-t">{m}</div>
                    <button className="mit-del" onClick={() => removeMIT(i)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mit-foot">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2a5 5 0 015 5c0 3.5-5 13-5 13S7 10.5 7 7a5 5 0 015-5z" />
                </svg>
                Drag MITs onto Time Blocks or the Weekly Plan to schedule them
              </div>
            </div>

            {/* Learning Hub */}
            <div className="card">
              <div className="ch">
                <span className="ch-t">
                  <svg viewBox="0 0 24 24">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                  </svg>
                  Learning Hub
                </span>
                <span className="ch-a" onClick={() => navigate("/learning-hub")}>
                  Continue
                </span>
              </div>
              <div className="hub-body">
                {topicLoading ? (
                  <p style={{ fontSize: 10, color: "var(--t3)" }}>Loading…</p>
                ) : !topic ? (
                  <p style={{ fontSize: 10, color: "var(--t3)" }}>No topics yet.</p>
                ) : topicDoneToday ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
                    <span className="hub-title" style={{ marginBottom: 0 }}>
                      {topic.title}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="hub-title">{topic.title}</div>
                    <div className="hub-quote">"{topic.description || "Continue your learning streak"}"</div>
                    <div className="hub-bar-bg">
                      <div className="hub-bar" style={{ width: `${topic.progress_percent ?? 0}%` }} />
                    </div>
                    <div className="hub-streak">🔥 {topic.current_streak ?? 0}-day streak</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Time Blocks + Pomodoro + Shutdown */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="ch">
              <span className="ch-t">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Time blocks
              </span>
              <span className="ch-a">+ Add</span>
            </div>
            <div
              className="tb-area"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("drag-over-list");
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drag-over-list")}
              onDrop={(e) => {
                e.currentTarget.classList.remove("drag-over-list");
                onTimeBlocksDrop(e);
              }}
            >
              {blocks.length === 0 ? (
                <div className="tb-emp">Drop MITs or backlog tasks here, or use + Add below.</div>
              ) : (
                blocks.map((b, i) => {
                  const now = getManilaDate();
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  const [h, m] = b.time.split(":").map(Number);
                  const active = Math.abs(h * 60 + m - nowMin) < 60;
                  return (
                    <div key={i} className={`tb-row${active ? " act" : ""}`}>
                      <span className="tb-tm">{b.time}</span>
                      <span className="tb-nm">{b.label}</span>
                      {active && <span className="tb-now">Now</span>}
                    </div>
                  );
                })
              )}
            </div>
            <div className="tb-add">
              <input type="time" value={tbTime} onChange={(e) => setTbTime(e.target.value)} />
              <input type="text" placeholder="Block label…" value={tbLabel} onChange={(e) => setTbLabel(e.target.value)} />
              <button
                onClick={() => {
                  addTimeBlock(tbTime, tbLabel.trim());
                  setTbLabel("");
                }}
              >
                Add
              </button>
            </div>

            {/* Pomodoro */}
            <div className="pom">
              <div className="pom-ring-wrap">
                <svg className="pom-ring-svg" viewBox="0 0 36 36">
                  <circle className="pom-ring-bg" cx="18" cy="18" r="15.9" />
                  <circle
                    className="pom-ring-fg"
                    cx="18"
                    cy="18"
                    r="15.9"
                    strokeDasharray={`${pomCirc} ${pomCirc}`}
                    strokeDashoffset={pomCirc - pomPct}
                  />
                </svg>
                <div className="pom-time">
                  {pomMin}:{pomSec}
                </div>
              </div>
              <div className="pom-info">
                <div className="pom-label">Pomodoro — Focus</div>
                <div className="pom-sub">{mits[0] ? `MIT 1 · ${mits[0]}` : "Select an MIT to link"}</div>
              </div>
              <div className="pom-btns">
                <button className={`pom-btn${pomRunning ? "" : " go"}`} onClick={togglePom}>
                  {pomRunning ? "Pause" : "Start"}
                </button>
                <button className="pom-btn" onClick={resetPom}>
                  Reset
                </button>
                <button className="pom-music" onClick={openLofi} title="Play Lofi music">
                  🎵 Lofi
                </button>
              </div>
            </div>

            {/* Shutdown */}
            {shutDone < 5 ? (
              <div className="shut">
                <div className="shut-hdr">
                  Shutdown Ritual<span className="shut-count">{shutDone}/5</span>
                </div>
                {SHUT_ITEMS.map((item) => (
                  <label key={item} className="shut-item">
                    <input type="checkbox" checked={!!shutChecked[item]} onChange={() => toggleShut(item)} /> {item}
                  </label>
                ))}
              </div>
            ) : (
              <div className="shut-done" style={{ display: "block" }}>
                <div className="shut-done-text">🎉 Success! Enjoy the rest of your day, Khalil.</div>
                <div className="shut-done-sub">All checks complete. Work is closed.</div>
              </div>
            )}
          </div>
        </div>
      </>
    ),
    growth: (
      <>
        <div className="zlbl pur">
          {zoneHandle}
          Pursuits, hitlist and brewing
        </div>
        <div className="growth">
          <div className="card">
            <div className="ch">
              <span className="ch-t" style={{ color: "var(--purple)" }}>
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="2" x2="12" y2="5" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="5" y2="12" />
                  <line x1="19" y1="12" x2="22" y2="12" />
                </svg>
                Crosshairs
              </span>
              <span className="ch-a pur" onClick={() => navigate("/crosshairs")}>
                + Add
              </span>
            </div>
            {crosshairs.length === 0 && <div style={{ padding: 10, fontSize: 10, color: "var(--t3)" }}>No targets yet.</div>}
            {crosshairs.slice(0, 5).map((t) => (
              <div key={t.id} className="xh-row" onClick={() => navigate("/crosshairs")}>
                <div className="xh-dot" style={{ background: PRIORITY_DOT[t.priority] }} />
                <div className="xh-n">{t.target_name}</div>
                <span className={`bdg ${PRIORITY_BADGE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
              </div>
            ))}
          </div>

          {/* Hitlist */}
          <div className="card">
            <div className="ch">
              <span className="ch-t">
                <svg viewBox="0 0 24 24">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                </svg>
                Hitlist
              </span>
              <span className="bdg bdg-r" style={{ marginRight: 4 }}>
                {staleCount} stale
              </span>
              <a
                className="ch-a"
                href={`https://app.clickup.com/${CLICKUP_WORKSPACE_ID}`}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none" }}
              >
                ClickUp ↗
              </a>
            </div>
            <div
              className="bl-area"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("drag-over-list");
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drag-over-list")}
              onDrop={(e) => {
                e.currentTarget.classList.remove("drag-over-list");
                onHitlistDrop(e);
              }}
            >
              {hitlist.length === 0 && <div style={{ padding: 10, fontSize: 10, color: "var(--t3)" }}>No open tasks.</div>}
              {hitlist.map((t) => (
                <div key={t.key} className="bl-row" draggable onDragStart={(e) => dragHitlistStart(e, t.label)}>
                  <div className="bl-dot" style={{ background: t.stale ? "var(--red)" : t.age > 7 ? "var(--orange)" : "var(--t4)" }} />
                  <div className="bl-n">{t.label}</div>
                  <span className="bl-age" style={{ color: t.stale ? "var(--red)" : t.age > 7 ? "var(--orange)" : "var(--t3)" }}>
                    {t.age}d
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Brewing */}
          <div className="card">
            <div className="ch">
              <span className="ch-t" style={{ color: "var(--purple)" }}>
                <svg viewBox="0 0 24 24">
                  <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
                </svg>
                Brewing
              </span>
              <span className="ch-a pur" onClick={() => navigate("/brewing")}>
                + Add
              </span>
            </div>
            {brewing.length === 0 && <div style={{ padding: 10, fontSize: 10, color: "var(--t3)" }}>Nothing here.</div>}
            {brewing.map((item) => (
              <div key={item.id} className="br-row">
                <div className="br-dot" style={{ background: BREWING_DOT[item.status] ?? "var(--t4)" }} />
                <div className="br-n">{item.name}</div>
                <span className={`bdg ${BREWING_BADGE[item.status] ?? "bdg-gr"}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    ),
    calendar: (
      <>
        <div className="zlbl">
          {zoneHandle}
          {calMonthLabel}
        </div>
        <div className="card">
          <div className="cal-wrap">
            <div className="cal-hdr">
              <button className="cal-nav" onClick={() => shiftMonth(-1)}>
                ← {MONTHS[(calCursor.month + 11) % 12]}
              </button>
              <span className="cal-month">{calMonthLabel}</span>
              <button className="cal-nav" onClick={() => shiftMonth(1)}>
                {MONTHS[(calCursor.month + 1) % 12]} →
              </button>
            </div>
            <div className="cal-grid">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="cal-dow">
                  {d}
                </div>
              ))}
              {Array.from({ length: calFirstWeekday }, (_, i) => (
                <div key={`e-${i}`} className="cal-d emp" />
              ))}
              {Array.from({ length: calDaysInMonth }, (_, i) => i + 1).map((d) => {
                const ds = `${calCursor.year}-${String(calCursor.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const isToday = ds === todayStr;
                const dots = calDots[ds];
                return (
                  <div key={ds} className={`cal-d${isToday ? " today" : ""}`}>
                    {d}
                    {dots && !isToday && dots.map((c, i) => <div key={i} className="cdot" style={{ background: `var(--${c})` }} />)}
                  </div>
                );
              })}
            </div>
            <div className="cal-leg">
              <div className="leg">
                <div className="leg-d" style={{ background: "var(--amber)" }} />
                RFQ closes
              </div>
              <div className="leg">
                <div className="leg-d" style={{ background: "var(--green)" }} />
                Delivery
              </div>
              <div className="leg">
                <div className="leg-d" style={{ background: "var(--blue)" }} />
                Invoice due
              </div>
              <div className="leg">
                <div className="leg-d" style={{ background: "var(--purple)" }} />
                Meetings
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  };

  return (
    <div className="shell">
      {showRitual && (
        <div className="morning-overlay">
          <div className="morning-modal">
            <div className="mm-head">
              <div className="mm-icon">🌅</div>
              <div className="mm-title">Good morning, Khalil.</div>
              <div className="mm-sub">3-minute ritual. Own your day.</div>
            </div>
            <div className="mm-body">
              {mmStep === 1 && (
                <div className="mm-step active">
                  <div className="mm-step-label">
                    <span>1</span> Name how you feel right now
                  </div>
                  <div className="mm-chips">
                    {["Focused", "Motivated", "Anxious", "Tired", "Calm", "Scattered", "Confident", "Heavy", "Energised", "Grateful"].map(
                      (c) => (
                        <span
                          key={c}
                          className={`mm-chip${chip === c ? " sel" : ""}`}
                          onClick={() => setChip(c)}
                        >
                          {c}
                        </span>
                      )
                    )}
                  </div>
                  <div className="mm-note">
                    Naming your emotional state reduces amygdala activation and improves focus. Takes 5 seconds.
                  </div>
                </div>
              )}
              {mmStep === 2 && (
                <div className="mm-step active">
                  <div className="mm-step-label">
                    <span>2</span> Energy level today
                  </div>
                  <div className="mm-energy">
                    {[
                      ["😔", "Low"],
                      ["😐", "Meh"],
                      ["🙂", "Good"],
                      ["😊", "Great"],
                      ["⚡", "On fire"],
                    ].map(([emoji, label], i) => (
                      <div
                        key={label}
                        className={`mm-e-btn${energyIdx === i ? " sel" : ""}`}
                        onClick={() => setEnergyIdx(i)}
                      >
                        <span className="mm-e-emoji">{emoji}</span>
                        <span className="mm-e-label">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mm-note" style={{ marginTop: 8 }}>
                    High energy: schedule deep work early. Low energy: start with admin. Honest self-assessment doubles
                    follow-through.
                  </div>
                </div>
              )}
              {mmStep === 3 && (
                <div className="mm-step active">
                  <div className="mm-step-label">
                    <span>3</span> One thing you are grateful for
                  </div>
                  <textarea
                    className="mm-textarea"
                    rows={3}
                    placeholder="e.g. Good sleep last night. Eloissa's support. The PGPC relationship."
                    value={gratitude}
                    onChange={(e) => setGratitude(e.target.value)}
                  />
                  <div className="mm-note" style={{ marginTop: 6 }}>
                    Gratitude reduces cortisol by up to 23% and primes the brain's reward circuits. Takes 20 seconds.
                  </div>
                </div>
              )}
              {mmStep === 4 && (
                <div className="mm-step active">
                  <div className="mm-step-label">
                    <span>4</span> Today's intention
                  </div>
                  <div className="mm-intention">
                    <strong>I will complete:</strong> MIT 1 — PGPC-081 quotation
                    <br />
                    <strong>I will start at:</strong> 9:00 AM at my desk
                    <br />
                    <strong>If distracted, I will:</strong> close all tabs and return to Mission Control
                  </div>
                  <div className="mm-note" style={{ marginTop: 6 }}>
                    "I will do X at time Y in place Z" doubles follow-through vs. goal-setting alone. Pre-filled from
                    last night's MITs.
                  </div>
                </div>
              )}
              {mmStep === 5 && (
                <div className="mm-step active">
                  <div className="mm-step-label">
                    <span>5</span> What matters most this week
                  </div>
                  <div className="mm-prime">
                    <div className="mm-prime-card">
                      <div className="mm-prime-label">Crosshairs — today's target</div>
                      <div className="mm-prime-val">{hottestTarget?.target_name ?? "No targets yet"}</div>
                      {hottestTarget && (
                        <div className="mm-prime-sub">
                          {hottestTarget.priority}
                          {hottestTarget.last_touchpoint_date
                            ? ` · Last contact ${Math.max(
                                0,
                                Math.round((Date.now() - new Date(hottestTarget.last_touchpoint_date)) / 86400000)
                              )} days ago`
                            : " · No touchpoints logged yet"}
                        </div>
                      )}
                    </div>
                    <div className="mm-prime-card">
                      <div className="mm-prime-label">OKR — SEO articles</div>
                      <div className="mm-prime-val">
                        {seoOkr ? `${seoOkr.current_count} of ${seoOkr.target_number} ${seoOkr.unit_label ?? ""}` : "No matching OKR yet"}
                      </div>
                      {seoOkr && (
                        <>
                          <div className="mm-prime-sub">
                            {seoPct}% · {Math.max(0, seoOkr.target_number - seoOkr.current_count)} {seoOkr.unit_label} remaining
                          </div>
                          <div className="mm-bar-bg">
                            <div className="mm-bar-fill" style={{ width: `${seoPct}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mm-note" style={{ marginTop: 6 }}>
                    Visual priming makes you 3× more likely to act on a target today. Read it. Don't skip this step.
                  </div>
                </div>
              )}
              {mmStep === "done" && (
                <div className="mm-step active">
                  <div className="mm-done">
                    <div className="mm-done-icon">✅</div>
                    <div className="mm-done-title">You are ready, Khalil.</div>
                    <div className="mm-done-sub">
                      Ritual complete. Mind primed, intention set.
                      <br />
                      Go execute.
                    </div>
                    <button className="mm-unlock" onClick={unlockMorning}>
                      Unlock Mission Control
                    </button>
                  </div>
                </div>
              )}
            </div>
            {mmStep !== "done" && (
              <div className="mm-foot">
                <div className="mm-dots">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`mm-dot${i <= mmStep ? " on" : ""}`} />
                  ))}
                </div>
                <button className="mm-skip" onClick={skipMorning}>
                  Skip for now
                </button>
                <button className="mm-next" onClick={nextStep}>
                  Continue →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="sb">
        <div className="sb-head">
          <div className="sb-logo">
            <div className="sb-icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div className="sb-app">Mission Control</div>
          </div>
          <div className="sb-co">Ultra Power</div>
          <div className="sb-role">Engineering Solutions Director</div>
        </div>

        <div className="sbi ab" onClick={() => navigate("/")}>
          <svg viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Home
        </div>
        <div className="sb-sec">Operations</div>
        <div className="sbi" onClick={() => navigate("/pipeline")}>
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="18" />
            <rect x="14" y="3" width="7" height="10" />
          </svg>
          Pipeline
        </div>
        <div className="sbi" onClick={() => navigate("/intake")}>
          <svg viewBox="0 0 24 24">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Intake
        </div>
        <div className="sbi" onClick={() => navigate("/sourcing")}>
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Sourcing
        </div>
        <div className="sbi" onClick={() => navigate("/quote-builder")}>
          <svg viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          </svg>
          Quote Builder
        </div>
        <div className="sbi" onClick={() => navigate("/ledger")}>
          <svg viewBox="0 0 24 24">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          Ledger
        </div>
        <div className="sb-sec">Growth</div>
        <div className="sbi" onClick={() => navigate("/crosshairs")}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Crosshairs
        </div>
        <div className="sbi" onClick={() => navigate("/wins")}>
          <svg viewBox="0 0 24 24">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          </svg>
          Wins
        </div>
        <div className="sbi" onClick={() => navigate("/okrs")}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          OKRs
        </div>
        <div className="sbi" onClick={() => navigate("/brewing")}>
          <svg viewBox="0 0 24 24">
            <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
          </svg>
          Brewing
        </div>
        <div className="sbi" onClick={() => navigate("/content")}>
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Content
        </div>
        <div className="sbi" onClick={() => navigate("/seo")}>
          <svg viewBox="0 0 24 24">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          SEO
        </div>
        <div className="sb-sec">Workspace</div>
        <div className="sbi" onClick={() => navigate("/contacts")}>
          <svg viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          Contacts
        </div>
        <div className="sbi" onClick={() => navigate("/learning-hub")}>
          <svg viewBox="0 0 24 24">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
          </svg>
          Learning Hub
        </div>
        <div className="sbi" onClick={() => navigate("/settings")}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93l-1.41 1.41M5.34 17.66l-1.41 1.41M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 18.66l1.41 1.41M2 12h2M20 12h2" />
          </svg>
          Settings
        </div>
        <div className="sb-foot">
          <div className="sb-user">
            <svg style={{ width: 11, height: 11, stroke: "currentColor", fill: "none", strokeWidth: 2 }} viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {user?.email === "khalil@ultrapowerindustrialinc.com" ? "Khalil J. Banares" : user?.email ?? "—"}
          </div>
          <div className="sb-ci">
            <div className="ci-dot" style={{ background: isComplete ? "var(--green)" : "var(--t4)" }} />
            <span style={{ fontSize: 8, color: isComplete ? "var(--green)" : "var(--t3)" }}>
              {isComplete ? "Ritual done" : "Ritual pending"}
            </span>
          </div>
          <button
            onClick={signOut}
            style={{ marginTop: 4, fontSize: 8, color: "var(--t3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div className="tb-l">
            <div className="tb-title">Good morning, Khalil.</div>
            <div className="tb-brief">
              <svg viewBox="0 0 24 24">
                <path d="M12 2a5 5 0 015 5c0 3.5-5 13-5 13S7 10.5 7 7a5 5 0 015-5z" />
              </svg>
              3 RFQs unanswered · PGPC-081 closes today.
            </div>
          </div>
          <div className="tb-r">
            <div className="pill">On Full Send</div>
            <button className="btn-s" onClick={() => window.location.reload()}>
              Sync
            </button>
            <button className="btn-p" onClick={() => navigate("/intake")}>
              + New RFQ
            </button>
          </div>
        </div>

        <div className="page">
          {/* NEW TASK BAR — fixed above the reorderable zones; not itself a zone */}
          <div className="new-task-bar">
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t2)", whiteSpace: "nowrap" }}>+ New task</span>
            <input
              type="text"
              placeholder="What needs to get done? Enter adds to MITs (or Hitlist if full)…"
              maxLength={100}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addNewTask();
              }}
            />
            <span className="nt-hint">Drag to Hitlist ↓</span>
            <button className="nt-btn" onClick={addNewTask}>
              Add
            </button>
          </div>

          {zoneOrder.map((id, index) => (
            <Fragment key={id}>
              {draggedZone && dragOverIndex === index && <div className="zone-drop-indicator" />}
              <div
                className={`zone-wrap${draggedZone === id ? " dragging" : ""}`}
                data-zone-id={id}
                draggable
                onDragStart={(e) => handleZoneDragStart(e, id)}
                onDragOver={(e) => handleZoneDragOver(e, index)}
                onDrop={handleZoneDrop}
                onDragEnd={handleZoneDragEnd}
              >
                {zoneContent[id]}
              </div>
            </Fragment>
          ))}
          {draggedZone && dragOverIndex === zoneOrder.length && <div className="zone-drop-indicator" />}
        </div>
      </div>
    </div>
  );
}

const PRIORITY_DOT = { Hot: "var(--red)", Medium: "var(--orange)", Low: "var(--t4)", Nurturing: "var(--t4)" };
const PRIORITY_BADGE = { Hot: "bdg-r", Medium: "bdg-a", Low: "bdg-gr", Nurturing: "bdg-gr" };
const PRIORITY_LABEL = { Hot: "Hot", Medium: "Med", Low: "Low", Nurturing: "Low" };
const BREWING_DOT = {
  Active: "var(--blue)",
  Planning: "var(--purple)",
  Draft: "var(--t3)",
  Scheduled: "var(--green)",
  Idea: "var(--t4)",
};
const BREWING_BADGE = { Active: "bdg-b", Planning: "bdg-p", Draft: "bdg-gr", Scheduled: "bdg-g", Idea: "bdg-gr" };

const phpFmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
function formatPhp(amount) {
  if (amount >= 1000) return `₱${Math.round(amount / 1000)}K`;
  return phpFmt.format(amount);
}

async function getSystemsAreaId() {
  try {
    const { data, error } = await supabase.from("areas").select("id").eq("name", "Systems").maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  } catch {
    return null;
  }
}
