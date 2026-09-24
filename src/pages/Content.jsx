import { useEffect, useState } from "react";
import { fetchContentItems } from "../lib/content";
import { daysInMonth, toISODate } from "../lib/dateUtils";
import { ChevronLeftIcon } from "../components/icons";
import ContentFormModal from "./content/ContentFormModal";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PLATFORM_STYLES = {
  Website: "bg-accent/20 text-accent",
  LinkedIn: "bg-sky-400/20 text-sky-300",
  Instagram: "bg-violet-400/20 text-violet-300",
  Email: "bg-emerald-400/20 text-emerald-300",
};

export default function Content() {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null); // { item } or { defaultDate }

  function load() {
    setLoading(true);
    fetchContentItems()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function handleSaved() {
    setFormState(null);
    load();
  }

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
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

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">Content</p>
          <h1 className="text-2xl font-semibold text-white">Content Calendar</h1>
          <p className="text-sm text-white/40 mt-1">Click any date to schedule something.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/50">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="text-sm text-white/70 font-medium w-32 text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 rotate-180">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-base-900 p-3">
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
            const dayItems = items.filter((i) => i.scheduled_date === iso);
            return (
              <button
                key={iso}
                onClick={() => setFormState({ defaultDate: iso })}
                className={`min-h-[90px] rounded-lg border px-1.5 py-1 text-left align-top hover:border-white/20 transition-colors ${
                  isToday ? "border-accent bg-accent/10" : "border-white/5"
                }`}
              >
                <p className={`text-xs ${isToday ? "text-accent font-semibold" : "text-white/50"}`}>{day}</p>
                <div className="space-y-0.5 mt-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormState({ item });
                      }}
                      className={`text-[10px] rounded px-1 py-0.5 truncate ${PLATFORM_STYLES[item.platform]}`}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <p className="text-[10px] text-white/30">+{dayItems.length - 3} more</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {!loading && items.length === 0 && (
        <p className="text-sm text-white/30 text-center py-4">Nothing scheduled yet — click a date to add something.</p>
      )}

      {formState && (
        <ContentFormModal
          item={formState.item}
          defaultDate={formState.defaultDate}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
