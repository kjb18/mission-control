import { useEffect, useState } from "react";
import { useCheckIn } from "../../lib/CheckInContext";

export default function MitsList() {
  const { todayLog, updateMits } = useCheckIn();
  const [mits, setMits] = useState(todayLog?.mits ?? []);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setMits(todayLog?.mits ?? []);
  }, [todayLog?.mits]);

  async function persist(next) {
    setMits(next);
    try {
      await updateMits(next);
    } catch {
      // best-effort; local state already reflects the change
    }
  }

  function addMit(e) {
    e.preventDefault();
    if (!draft.trim() || mits.length >= 3) return;
    persist([...mits, { text: draft.trim(), done: false }]);
    setDraft("");
  }

  function toggleMit(i) {
    persist(mits.map((m, idx) => (idx === i ? { ...m, done: !m.done } : m)));
  }

  function removeMit(i) {
    persist(mits.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <p className="text-xs font-medium text-white/50 mb-2">
        Most Important Tasks ({mits.length}/3)
      </p>
      <ul className="space-y-1.5 mb-2">
        {mits.map((m, i) => (
          <li
            key={i}
            className="flex items-center gap-2 bg-base-800 border border-white/10 rounded-lg px-3 py-2"
          >
            <button
              onClick={() => toggleMit(i)}
              className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                m.done ? "bg-accent border-accent" : "border-white/30"
              }`}
            >
              {m.done && (
                <svg viewBox="0 0 24 24" className="w-3 h-3 text-base-950" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className={`text-sm flex-1 ${m.done ? "line-through text-white/30" : "text-white/85"}`}>
              {m.text}
            </span>
            <button onClick={() => removeMit(i)} className="text-white/20 hover:text-white/60 text-xs">
              ✕
            </button>
          </li>
        ))}
      </ul>
      {mits.length < 3 && (
        <form onSubmit={addMit} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a most important task…"
            className="flex-1 rounded-lg bg-base-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            className="px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
