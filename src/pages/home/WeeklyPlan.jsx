import { useState } from "react";
import { useLocalStorage } from "../../lib/useLocalStorage";
import { startOfWeek, addDays, toISODate, formatWeekday, formatDayNumber } from "../../lib/dateUtils";
import { useWeekEvents } from "../../lib/useWeekEvents";
import { createEvent, CALENDAR_PUSH_ENABLED } from "../../lib/googleCalendar";
import SectionHeader from "./SectionHeader";

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8am - 6pm

function slotKey(dateISO, hour) {
  return `${dateISO}_${hour}`;
}

export default function WeeklyPlan() {
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const weekKey = `mc:weekplan:${toISODate(weekStart)}`;
  const [blocks, setBlocks] = useLocalStorage(weekKey, {});
  const [editingSlot, setEditingSlot] = useState(null);
  const [draft, setDraft] = useState("");
  const [syncNotice, setSyncNotice] = useState(null);
  const todayISO = toISODate(new Date());

  const { pipelineByDate, meetingEvents, calendarError } = useWeekEvents(weekStart, weekEnd);

  function meetingsForSlot(iso, hour) {
    return meetingEvents.filter(
      (ev) => ev.start && toISODate(ev.start) === iso && ev.start.getHours() === hour
    );
  }

  function openEditor(dateISO, hour) {
    const key = slotKey(dateISO, hour);
    setEditingSlot(key);
    setDraft(blocks[key] ?? "");
  }

  async function commit(dateISO, hour) {
    if (!editingSlot) return;
    const label = draft.trim();
    setBlocks((prev) => {
      const next = { ...prev };
      if (label) next[editingSlot] = label;
      else delete next[editingSlot];
      return next;
    });
    setEditingSlot(null);
    setDraft("");

    if (label) {
      const start = new Date(`${dateISO}T${String(hour).padStart(2, "0")}:00:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const result = await createEvent({ title: label, start, end });
      setSyncNotice(result?.skipped ? result.reason : "Synced to Google Calendar.");
    }
  }

  return (
    <section>
      <SectionHeader
        eyebrow="This Week"
        title="Weekly Plan"
        subtitle="Block your five working days. Click a slot to add a focus block."
      />

      {!CALENDAR_PUSH_ENABLED && (
        <p className="text-xs text-white/30 mb-3">
          Calendar sync: read-only (Google OAuth not connected yet — new blocks won't push to
          Google Calendar).
        </p>
      )}
      {calendarError && (
        <p className="text-xs text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-3">
          {calendarError}
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-base-900 overflow-x-auto">
        <div className="min-w-[720px] grid grid-cols-[64px_repeat(5,1fr)]">
          <div className="border-b border-white/10" />
          {days.map((d) => {
            const iso = toISODate(d);
            const isToday = iso === todayISO;
            const dayEvents = pipelineByDate[iso] ?? [];
            const dayMeetings = meetingEvents.filter((ev) => ev.start && toISODate(ev.start) === iso);
            return (
              <div
                key={iso}
                className={`border-b border-l border-white/10 px-3 py-2 text-center ${
                  isToday ? "bg-accent/10" : ""
                }`}
              >
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  {formatWeekday(d)}
                </p>
                <p className={`text-sm font-semibold ${isToday ? "text-accent" : "text-white/80"}`}>
                  {formatDayNumber(d)}
                </p>
                <div className="flex justify-center gap-0.5 mt-1 h-1.5">
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <span key={`p-${i}`} title={ev.label} className={`w-1.5 h-1.5 rounded-full ${ev.color}`} />
                  ))}
                  {dayMeetings.slice(0, 2).map((ev, i) => (
                    <span key={`m-${i}`} title={ev.title} className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  ))}
                </div>
              </div>
            );
          })}

          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-white/5 px-2 py-2 text-right text-[11px] text-white/30">
                {hour % 12 === 0 ? 12 : hour % 12}
                {hour < 12 ? "a" : "p"}
              </div>
              {days.map((d) => {
                const iso = toISODate(d);
                const key = slotKey(iso, hour);
                const isEditing = editingSlot === key;
                const value = blocks[key];
                const meetings = meetingsForSlot(iso, hour);
                return (
                  <div
                    key={key}
                    className="border-b border-l border-white/5 min-h-[38px] px-1 py-1 flex flex-col gap-0.5"
                  >
                    {meetings.map((m) => (
                      <div
                        key={m.id}
                        title={`${m.title} (from Google Calendar)`}
                        className="rounded px-1.5 py-0.5 text-[10px] truncate bg-violet-400/20 text-violet-200 border border-violet-400/30"
                      >
                        {m.title}
                      </div>
                    ))}
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit(iso, hour)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit(iso, hour);
                          if (e.key === "Escape") setEditingSlot(null);
                        }}
                        className="w-full h-full bg-base-800 border border-accent/50 rounded px-1.5 py-1 text-xs text-white focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => openEditor(iso, hour)}
                        className={`w-full h-full rounded px-1.5 py-1 text-left text-xs truncate transition-colors ${
                          value
                            ? "bg-accent/20 text-white/90 hover:bg-accent/25"
                            : "hover:bg-white/5 text-transparent"
                        }`}
                      >
                        {value || "·"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {syncNotice && <p className="text-xs text-white/30 mt-2">{syncNotice}</p>}
    </section>
  );
}
