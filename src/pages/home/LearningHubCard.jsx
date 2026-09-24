import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTopics, loggedToday } from "../../lib/learningHub";

/**
 * "Highest priority" active topic — no priority field exists on the
 * table, so this picks the one most urgently needing today's session:
 * not-yet-logged-today first, then the biggest streak to protect.
 */
function pickPriorityTopic(topics) {
  const active = topics.filter((t) => t.status === "active");
  if (active.length === 0) return null;
  return [...active].sort((a, b) => {
    const aDone = loggedToday(a) ? 1 : 0;
    const bDone = loggedToday(b) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (b.current_streak ?? 0) - (a.current_streak ?? 0);
  })[0];
}

export default function LearningHubCard() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopics()
      .then((data) => setTopic(pickPriorityTopic(data)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-base-900 p-4">
        <p className="text-xs text-white/30">Loading…</p>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="rounded-2xl border border-white/10 bg-base-900 p-4">
        <p className="text-sm font-semibold text-white mb-1">Learning Hub</p>
        <p className="text-xs text-white/30">No active topics.</p>
      </div>
    );
  }

  const doneToday = loggedToday(topic);

  if (doneToday) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-sm text-white/85 truncate">{topic.title}</span>
        </div>
        <span className="text-xs text-amber-300 shrink-0 ml-2">🔥 {topic.current_streak}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-base-900 p-4">
      <p className="text-xs font-medium text-white/50 mb-2">Learning Hub</p>
      <p className="text-sm font-semibold text-white mb-2">{topic.title}</p>
      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
        <div className="h-full bg-accent" style={{ width: `${topic.progress_percent}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-amber-300">
          🔥 {topic.current_streak} day{topic.current_streak === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => navigate(`/learning-hub?topic=${topic.id}&log=1`)}
          className="text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-base-950 font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
