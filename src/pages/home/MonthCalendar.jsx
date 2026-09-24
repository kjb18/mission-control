import { useState } from "react";
import SectionHeader from "./SectionHeader";
import { useMonthEvents } from "../../lib/useMonthEvents";
import { daysInMonth, toISODate } from "../../lib/dateUtils";
import { ChevronLeftIcon } from "../../components/icons";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LEGEND = [
  { label: "RFQ", color: "bg-amber-400" },
  { label: "Delivery", color: "bg-emerald-400" },
  { label: "Invoice", color: "bg-blue-400" },
  { label: "Meeting", color: "bg-violet-400" },
];

export default function MonthCalendar() {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const { eventsByDate, calendarError } = useMonthEvents(cursor.year, cursor.month);

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const totalDays = daysInMonth(cursor.year, cursor.month);
  const todayISO = toISODate(today);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  function shiftMonth(delta) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <section>
      <SectionHeader
        eyebrow="Overview"
        title="Month Calendar"
        subtitle="RFQ, delivery, and invoice dates, plus synced Google Calendar meetings."
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/50"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-sm text-white/70 font-medium w-32 text-center">
              {monthLabel}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 rotate-180"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {calendarError && (
        <p className="text-xs text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-3">
          {calendarError}
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-base-900 p-3">
        <div className="flex flex-wrap gap-3 px-1 pb-2 mb-1 border-b border-white/5">
          {LEGEND.map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] text-white/40">
              <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-center text-[11px] text-white/30 py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} />;
            const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = iso === todayISO;
            const events = eventsByDate[iso] ?? [];
            return (
              <div
                key={iso}
                className={`min-h-[64px] rounded-lg border px-1.5 py-1 ${
                  isToday ? "border-accent bg-accent/10" : "border-white/5"
                }`}
              >
                <p className={`text-xs ${isToday ? "text-accent font-semibold" : "text-white/50"}`}>
                  {day}
                </p>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {events.slice(0, 4).map((ev, i) => (
                    <span
                      key={i}
                      title={ev.label}
                      className={`w-1.5 h-1.5 rounded-full ${ev.color}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
