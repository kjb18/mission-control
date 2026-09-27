import { useClickUpTasks } from "../../lib/useClickUpTasks";
import { Card, Badge } from "../../components/ui";

function formatDueDate(date) {
  if (!date) return "No due date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function BacklogPanel() {
  const { tasks, loading, error, refresh } = useClickUpTasks();
  const staleCount = tasks.filter((t) => t.isStale).length;

  function handleDragStart(e, task) {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        source: "clickup",
        id: task.id,
        name: task.name,
        url: task.url,
      })
    );
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        <p className="text-sm font-semibold text-white">Backlog</p>
        <Badge variant="gray">ClickUp</Badge>
        {staleCount > 0 && <Badge variant="red">{staleCount} stale</Badge>}
        <span className="ml-auto text-xs text-ink-muted">{tasks.length}</span>
        <button
          onClick={refresh}
          title="Refresh from ClickUp"
          className="text-ink-muted hover:text-ink-secondary text-xs"
        >
          ↻
        </button>
      </div>

      {error && (
        <p className="text-xs text-orange-600/80 bg-orange-500/10 border border-orange-500/20 rounded-[10px] px-3 py-2 mb-2">
          {error}
        </p>
      )}

      <ul className="space-y-1.5 flex-1 max-h-52 overflow-y-auto">
        {loading && (
          <li className="text-xs text-ink-muted px-1 py-1">Loading tasks…</li>
        )}
        {!loading && !error && tasks.length === 0 && (
          <li className="text-xs text-ink-muted px-1 py-1">No open tasks in the Admin folder.</li>
        )}
        {tasks.map((task) => (
          <li
            key={task.id}
            draggable
            onDragStart={(e) => handleDragStart(e, task)}
            title="Drag onto Today's Time Blocks to schedule"
            className="flex flex-col gap-1 bg-base-800 border border-line rounded-[10px] px-3 py-2 cursor-grab active:cursor-grabbing hover:border-line-strong"
          >
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-white hover:text-accent truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {task.name}
            </a>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-ink-secondary">{formatDueDate(task.dueDate)}</span>
              <Badge variant={task.isStale ? "red" : "gray"} className="ml-auto">
                {task.daysSinceActivity === null ? "—" : `${task.daysSinceActivity}d`}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
