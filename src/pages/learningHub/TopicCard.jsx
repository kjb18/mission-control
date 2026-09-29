import { useState } from "react";
import { loggedToday } from "../../lib/learningHub";
import { Card, Badge, Button } from "../../components/ui";

const STATUS_VARIANT = {
  active: "green",
  paused: "amber",
  completed: "blue",
};

// learning_topics has no cover column today; pick one up if it's ever added,
// otherwise show the title's first letter (matches the homepage card).
const COVER_FIELDS = ["cover_image_url", "image_url", "cover_url"];
function coverUrl(topic) {
  const key = COVER_FIELDS.find((k) => k in topic) ?? Object.keys(topic).find((k) => /image|cover/i.test(k));
  const url = key ? topic[key] : null;
  return typeof url === "string" && url.trim() ? url : null;
}

function TopicThumb({ topic }) {
  const url = coverUrl(topic);
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt="" onError={() => setFailed(true)} className="w-7 h-7 rounded object-cover shrink-0" />;
  }
  return (
    <div className="w-7 h-7 rounded shrink-0 flex items-center justify-center text-xs font-bold bg-blue-100 text-blue-700">
      {(topic.title ?? "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

export default function TopicCard({ topic, onLogSession, onEdit, highlighted }) {
  const doneToday = loggedToday(topic);

  return (
    <Card className={`space-y-3 transition-colors ${highlighted ? "!border-accent" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <TopicThumb topic={topic} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{topic.title}</p>
            <p className="text-xs text-ink-secondary">{topic.category || "—"}</p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[topic.status]} className="shrink-0">
          {topic.status}
        </Badge>
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
        <Button
          variant="primary"
          className="flex-1"
          disabled={doneToday}
          onClick={() => onLogSession(topic)}
        >
          {doneToday ? "Logged today ✓" : "Log Session"}
        </Button>
        <Button variant="secondary" onClick={() => onEdit(topic)}>
          Edit
        </Button>
      </div>
    </Card>
  );
}
