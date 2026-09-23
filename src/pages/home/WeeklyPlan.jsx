import { useState } from "react";
import { useLocalStorage } from "../../lib/useLocalStorage";
import { startOfWeek, addDays, toISODate, formatWeekday, formatDayNumber } from "../../lib/dateUtils";
import SectionHeader from "./SectionHeader";

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8am - 6pm

function slotKey(dateISO, hour) {
  return `${dateISO}_${hour}`;
}

export default function WeeklyPlan() {
  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const weekKey = `mc:weekplan:${toISODate(weekStart)}`;
  const [blocks, setBlocks] = useLocalStorage(weekKey, {});
  const [editingSlot, setEditingSlot] = useState(null);
  const [draft, setDraft] = useState("");
  const todayISO = toISODate(new Date());

  function openEditor(dateISO, hour) {
    const key = slotKey(dateISO, hour);
    setEditingSlot(key);
    setDraft(blocks[key] ?? "");
  }

  function commit() {
    if (!editingSlot) return;
    setBlocks((prev) => {
      const next = { ...prev };
      if (draft.trim()) next[editingSlot] = draft.trim();
      else delete next[editingSlot];
      return next;
    });
    setEditingSlot(null);
    setDraft("");
  }

  return (
    <section>
      <SectionHeader
        eyebrow="This Week"
        title="Weekly Plan"
        subtitle="Block your five working days. Click a slot to add a focus block."
      />

      <div className="rounded-2xl border border-white/10 bg-base-900 overflow-x-auto">
        <div className="min-w-[720px] grid grid-cols-[64px_repeat(5,1fr)]">
          <div className="border-b border-white/10" />
          {days.map((d) => {
            const iso = toISODate(d);
            const isToday = iso === todayISO;
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
                return (
                  <div
                    key={key}
                    className="border-b border-l border-white/5 min-h-[38px] px-1 py-1"
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit();
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
    </section>
  );
}
