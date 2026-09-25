import { useState } from "react";
import { useLocalStorage } from "../../lib/useLocalStorage";
import { startOfWeek, addDays, toISODate, formatWeekday, formatDayNumber } from "../../lib/dateUtils";
import { useWeekEvents } from "../../lib/useWeekEvents";
import { createEvent, updateEvent } from "../../lib/googleCalendar";
import { hasConnectedBefore } from "../../lib/googleAuth";
import SectionHeader from "./SectionHeader";

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8am - 6pm

function slotKey(dateISO, hour) {
  return `${dateISO}_${hour}`;
}

// Block values used to be plain strings; normalize old data transparently.
function blockLabel(value) {
  return typeof value === "string" ? value : value?.label ?? "";
}
function blockEventId(value) {
  return typeof value === "string" ? null : value?.googleEventId ?? null;
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
    setDraft(blockLabel(blocks[key]));
  }

  async function commit(dateISO, hour) {
    if (!editingSlot) return;
    const label = draft.trim();
    const existing = blocks[editingSlot];
    const existingEventId = blockEventId(existing);
    setEditingSlot(null);
    setDraft("");

    if (!label) {
      setBlocks((prev) => {
        const next = { ...prev };
        delete next[editingSlot];
        return next;
      });
      return;
    }

    const start = new Date(`${dateISO}T${String(hour).padStart(2, "0")}:00:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    let result;
    if (existingEventId) {
      result = await updateEvent(existingEventId, { title: label, start, end });
    } else {
      result = await createEvent({ title: label, start, end });
    }

    const googleEventId = result?.skipped ? existingEventId : result?.id ?? null;
    setBlocks((prev) => ({ ...prev, [editingSlot]: { label, googleEventId } }));
    setSyncNotice(
      result?.skipped
        ? result.reason
        : existingEventId
        ? "Google Calendar event updated."
        : "Synced to Google Calendar."
    );
  }

  return (
    <section>
      <SectionHeader
        eyebrow="This Week"
        title="Weekly Plan"
        subtitle="Block your five working days. Click a slot to add a focus block."
      />

      {!hasConnectedBefore() && (
        <p className="text-xs text-ink-muted mb-3">
          Google Calendar isn't connected — connect it in Settings to push new blocks and see
          private events.
        </p>
      )}
      {calendarError && (
        <p className="text-xs text-orange-400/80 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-3">
          {calendarError}
        </p>
      )}

      <div className="rounded-lg border border-line bg-base-900 overflow-x-auto">
        <div className="min-w-[720px] grid grid-cols-[64px_repeat(5,1fr)]">
          <div className="border-b border-line" />
          {days.map((d) => {
            const iso = toISODate(d);
            const isToday = iso === todayISO;
            const dayEvents = pipelineByDate[iso] ?? [];
            const dayMeetings = meetingEvents.filter((ev) => ev.start && toISODate(ev.start) === iso);
            return (
              <div
                key={iso}
                className={`border-b border-l border-line px-3 py-2 text-center ${
                  isToday ? "bg-accent/10" : ""
                }`}
              >
                <p className="text-[11px] uppercase tracking-wide text-ink-secondary">
                  {formatWeekday(d)}
                </p>
                <p className={`text-sm font-semibold ${isToday ? "text-accent" : "text-white"}`}>
                  {formatDayNumber(d)}
                </p>
                <div className="flex justify-center gap-0.5 mt-1 h-1.5">
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <span key={`p-${i}`} title={ev.label} className={`w-1.5 h-1.5 rounded-full ${ev.color}`} />
                  ))}
                  {dayMeetings.slice(0, 2).map((ev, i) => (
                    <span key={`m-${i}`} title={ev.title} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  ))}
                </div>
              </div>
            );
          })}

          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-line px-2 py-2 text-right text-[11px] text-ink-muted">
                {hour % 12 === 0 ? 12 : hour % 12}
                {hour < 12 ? "a" : "p"}
              </div>
              {days.map((d) => {
                const iso = toISODate(d);
                const key = slotKey(iso, hour);
                const isEditing = editingSlot === key;
                const value = blockLabel(blocks[key]);
                const meetings = meetingsForSlot(iso, hour);
                return (
                  <div
                    key={key}
                    className="border-b border-l border-line min-h-[38px] px-1 py-1 flex flex-col gap-0.5"
                  >
                    {meetings.map((m) => (
                      <div
                        key={m.id}
                        title={`${m.title} (from Google Calendar)`}
                        className="rounded px-1.5 py-0.5 text-[10px] truncate bg-blue-500/20 text-blue-300 border border-blue-500/30"
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
                            : "hover:bg-base-800/60 text-transparent"
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

      {syncNotice && <p className="text-xs text-ink-muted mt-2">{syncNotice}</p>}
    </section>
  );
}
