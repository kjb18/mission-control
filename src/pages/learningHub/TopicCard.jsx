import { loggedToday } from "../../lib/learningHub";
import { Card, Badge, Button } from "../../components/ui";

const STATUS_VARIANT = {
  active: "green",
  paused: "amber",
  completed: "blue",
};

export default function TopicCard({ topic, onLogSession, onEdit, highlighted }) {
  const doneToday = loggedToday(topic);

  return (
    <Card className={`space-y-3 transition-colors ${highlighted ? "!border-accent" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{topic.title}</p>
          <p className="text-xs text-ink-secondary">{topic.category || "—"}</p>
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
