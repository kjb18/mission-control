import { loggedToday } from "../../lib/learningHub";

const STATUS_STYLES = {
  active: "text-emerald-700 bg-emerald-400/15",
  paused: "text-orange-600 bg-orange-500/15",
  completed: "text-blue-600 bg-blue-500/15",
};

export default function TopicCard({ topic, onLogSession, onEdit, highlighted }) {
  const doneToday = loggedToday(topic);

  return (
    <div
      className={`rounded-[10px] border bg-base-900 p-4 space-y-3 transition-colors ${
        highlighted ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{topic.title}</p>
          <p className="text-xs text-ink-secondary">{topic.category || "—"}</p>
        </div>
        <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${STATUS_STYLES[topic.status]}`}>
          {topic.status}
        </span>
      </div>

      {topic.description && <p className="text-xs text-ink-secondary line-clamp-2">{topic.description}</p>}

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-ink-secondary">Progress</span>
          <span className="text-ink-secondary">{topic.progress_percent}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-base-800/60 overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${topic.progress_percent}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-orange-600">
          🔥 {topic.current_streak} day{topic.current_streak === 1 ? "" : "s"}
        </span>
        <span className="text-ink-muted">
          {topic.last_session_date ? `Last: ${topic.last_session_date}` : "No sessions yet"}
        </span>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onLogSession(topic)}
          disabled={doneToday}
          className="flex-1 text-xs px-3 py-1.5 rounded-[10px] bg-accent hover:bg-accent-light disabled:opacity-40 text-base-950 font-medium"
        >
          {doneToday ? "Logged today ✓" : "Log Session"}
        </button>
        <button
          onClick={() => onEdit(topic)}
          className="text-xs px-3 py-1.5 rounded-[10px] bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white font-medium"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
