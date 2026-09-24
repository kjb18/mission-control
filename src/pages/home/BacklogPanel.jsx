import { useClickUpTasks } from "../../lib/useClickUpTasks";

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
    <div className="rounded-2xl border border-white/10 bg-base-900 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        <p className="text-sm font-semibold text-white">Backlog</p>
        <span className="text-[10px] uppercase tracking-wide text-white/30 bg-white/5 rounded px-1.5 py-0.5">
          ClickUp
        </span>
        {staleCount > 0 && (
          <span className="text-[10px] font-medium text-red-300 bg-red-400/15 rounded-full px-1.5 py-0.5">
            {staleCount} stale
          </span>
        )}
        <span className="ml-auto text-xs text-white/30">{tasks.length}</span>
        <button
          onClick={refresh}
          title="Refresh from ClickUp"
          className="text-white/30 hover:text-white/70 text-xs"
        >
          ↻
        </button>
      </div>

      {error && (
        <p className="text-xs text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-2">
          {error}
        </p>
      )}

      <ul className="space-y-1.5 flex-1 max-h-52 overflow-y-auto">
        {loading && (
          <li className="text-xs text-white/30 px-1 py-1">Loading tasks…</li>
        )}
        {!loading && !error && tasks.length === 0 && (
          <li className="text-xs text-white/30 px-1 py-1">No open tasks in the Admin folder.</li>
        )}
        {tasks.map((task) => (
          <li
            key={task.id}
            draggable
            onDragStart={(e) => handleDragStart(e, task)}
            title="Drag onto Today's Time Blocks to schedule"
            className="flex flex-col gap-1 bg-base-800 border border-white/10 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing hover:border-white/20"
          >
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-white/85 hover:text-accent truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {task.name}
            </a>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-white/40">{formatDueDate(task.dueDate)}</span>
              <span
                className={`ml-auto font-medium rounded-full px-1.5 py-0.5 ${
                  task.isStale
                    ? "text-red-300 bg-red-400/15"
                    : "text-white/40 bg-white/5"
                }`}
              >
                {task.daysSinceActivity === null ? "—" : `${task.daysSinceActivity}d`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
