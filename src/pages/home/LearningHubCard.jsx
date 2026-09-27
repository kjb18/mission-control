import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTopics, loggedToday } from "../../lib/learningHub";
import { Card, CardHeader } from "../../components/ui";
import { LearningIcon } from "../../components/icons";

/**
 * "Today's module" — no priority field exists on the table, so this picks
 * the one most urgently needing today's session: not-yet-logged-today
 * first, then the biggest streak to protect.
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

const HEADER_TITLE = (
  <span className="flex items-center gap-1.5">
    <LearningIcon className="w-3 h-3" />
    Learning Hub
  </span>
);

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

  function goContinue() {
    if (topic) navigate(`/learning-hub?topic=${topic.id}&log=1`);
  }

  const continueAction = (
    <button
      onClick={goContinue}
      disabled={!topic}
      className="text-[10px] font-medium text-accent hover:text-accent-light disabled:opacity-40 disabled:pointer-events-none"
    >
      Continue
    </button>
  );

  if (loading) {
    return (
      <Card noPadding>
        <CardHeader title={HEADER_TITLE} action={continueAction} />
        <p className="text-xs text-ink-muted px-5 py-3">Loading…</p>
      </Card>
    );
  }

  if (!topic) {
    return (
      <Card noPadding>
        <CardHeader title={HEADER_TITLE} action={continueAction} />
        <p className="text-xs text-ink-muted px-5 py-3">No active topics.</p>
      </Card>
    );
  }

  const doneToday = loggedToday(topic);

  if (doneToday) {
    return (
      <Card noPadding>
        <CardHeader title={HEADER_TITLE} action={continueAction} />
        <div className="flex items-center gap-2 px-5 py-3 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-[11px] font-medium text-white truncate">{topic.title}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card noPadding>
      <CardHeader title={HEADER_TITLE} action={continueAction} />
      <div className="px-5 py-3">
        <p className="text-[11px] font-medium text-white truncate">{topic.title}</p>
        {topic.description && (
          <p
            className="text-[10px] italic mt-1"
            style={{
              color: "#64748b",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            “{topic.description}”
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 rounded-full bg-base-800/60 overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${topic.progress_percent}%` }} />
          </div>
          <span className="text-[10px] text-orange-600 shrink-0">
            🔥 {topic.current_streak}
          </span>
        </div>
      </div>
    </Card>
  );
}
