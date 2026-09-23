import { useLocalStorage } from "../../lib/useLocalStorage";
import { todayISODate } from "../../lib/dateUtils";

const DEFAULT_ITEMS = [
  "Inbox zero",
  "Tomorrow's MITs set",
  "Desk cleared",
  "Wins logged",
  "Calendar checked for tomorrow",
];

export default function ShutdownRitual() {
  const [checked, setChecked] = useLocalStorage(`mc:shutdown:${todayISODate()}`, {});
  const doneCount = DEFAULT_ITEMS.filter((item) => checked[item]).length;
  const allDone = doneCount === DEFAULT_ITEMS.length;

  function toggle(item) {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-white/50">Shutdown Ritual</p>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            allDone ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-white/40"
          }`}
        >
          {doneCount}/{DEFAULT_ITEMS.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {DEFAULT_ITEMS.map((item) => (
          <li key={item}>
            <button
              onClick={() => toggle(item)}
              className="w-full flex items-center gap-2 bg-base-800 border border-white/10 rounded-lg px-3 py-2 text-left hover:border-white/20"
            >
              <span
                className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                  checked[item] ? "bg-emerald-400 border-emerald-400" : "border-white/30"
                }`}
              >
                {checked[item] && (
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-base-950" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={`text-sm ${checked[item] ? "line-through text-white/30" : "text-white/85"}`}>
                {item}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
