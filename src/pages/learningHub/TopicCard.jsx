import { loggedToday } from "../../lib/learningHub";

const STATUS_STYLES = {
  active: "text-emerald-300 bg-emerald-400/15",
  paused: "text-amber-300 bg-amber-400/15",
  completed: "text-sky-300 bg-sky-400/15",
};

export default function TopicCard({ topic, onLogSession, onEdit, highlighted }) {
  const doneToday = loggedToday(topic);

  return (
    <div
      className={`rounded-2xl border bg-base-900 p-4 space-y-3 transition-colors ${
        highlighted ? "border-accent" : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{topic.title}</p>
          <p className="text-xs text-white/40">{topic.category || "—"}</p>
        </div>
        <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${STATUS_STYLES[topic.status]}`}>
          {topic.status}
        </span>
      </div>

      {topic.description && <p className="text-xs text-white/40 line-clamp-2">{topic.description}</p>}

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-white/50">Progress</span>
          <span className="text-white/70">{topic.progress_percent}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${topic.progress_percent}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-amber-300">
          🔥 {topic.current_streak} day{topic.current_streak === 1 ? "" : "s"}
        </span>
        <span className="text-white/30">
          {topic.last_session_date ? `Last: ${topic.last_session_date}` : "No sessions yet"}
        </span>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onLogSession(topic)}
          disabled={doneToday}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-40 text-base-950 font-medium"
        >
          {doneToday ? "Logged today ✓" : "Log Session"}
        </button>
        <button
          onClick={() => onEdit(topic)}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
