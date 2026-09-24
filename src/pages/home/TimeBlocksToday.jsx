import { useState } from "react";
import { useLocalStorage } from "../../lib/useLocalStorage";
import { todayISODate } from "../../lib/dateUtils";
import { createEvent } from "../../lib/googleCalendar";
import { updateTaskDueDate } from "../../lib/clickup";

function nextAvailableTime(existingBlocks) {
  const now = new Date();
  let candidate = new Date(now);
  candidate.setSeconds(0, 0);
  const remainder = candidate.getMinutes() % 30;
  candidate.setMinutes(candidate.getMinutes() + (remainder === 0 ? 0 : 30 - remainder));

  const usedTimes = new Set(existingBlocks.map((b) => b.time));
  let timeStr = formatHHMM(candidate);
  while (usedTimes.has(timeStr)) {
    candidate.setMinutes(candidate.getMinutes() + 30);
    timeStr = formatHHMM(candidate);
  }
  return { timeStr, date: candidate };
}

function formatHHMM(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function TimeBlocksToday() {
  const [blocks, setBlocks] = useLocalStorage(`mc:timeblocks:${todayISODate()}`, []);
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  function addBlock(e) {
    e.preventDefault();
    if (!time || !label.trim()) return;
    const next = [...blocks, { id: crypto.randomUUID(), time, label: label.trim() }].sort(
      (a, b) => a.time.localeCompare(b.time)
    );
    setBlocks(next);
    setTime("");
    setLabel("");
  }

  function removeBlock(id) {
    setBlocks(blocks.filter((b) => b.id !== id));
  }

  async function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let task;
    try {
      task = JSON.parse(raw);
    } catch {
      return;
    }
    if (task.source !== "clickup") return;

    const { timeStr, date } = nextAvailableTime(blocks);
    const newBlock = {
      id: crypto.randomUUID(),
      time: timeStr,
      label: task.name,
      source: "clickup",
      clickupTaskId: task.id,
      clickupUrl: task.url,
    };
    setBlocks([...blocks, newBlock].sort((a, b) => a.time.localeCompare(b.time)));

    const end = new Date(date.getTime() + 30 * 60 * 1000);
    const calendarResult = await createEvent({ title: task.name, start: date, end });

    try {
      await updateTaskDueDate(task.id, date);
      setSyncStatus(
        calendarResult?.skipped
          ? `Scheduled at ${timeStr} — ClickUp due date updated. (${calendarResult.reason})`
          : `Scheduled at ${timeStr} — synced to ClickUp and Google Calendar.`
      );
    } catch (err) {
      setSyncStatus(`Scheduled at ${timeStr}, but couldn't update ClickUp: ${err.message}`);
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-white/50 mb-2">Today's Time Blocks</p>
      <ul
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`space-y-1.5 mb-2 max-h-40 overflow-y-auto rounded-lg transition-colors ${
          isDragOver ? "ring-2 ring-accent bg-accent/5" : ""
        }`}
      >
        {blocks.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-2 bg-base-800 border border-white/10 rounded-lg px-3 py-1.5"
          >
            <span className="text-xs font-mono text-accent w-14 shrink-0">{b.time}</span>
            <span className="text-sm text-white/80 flex-1 truncate">{b.label}</span>
            {b.source === "clickup" && (
              <span className="text-[10px] uppercase tracking-wide text-white/30 bg-white/5 rounded px-1 py-0.5 shrink-0">
                ClickUp
              </span>
            )}
            <button onClick={() => removeBlock(b.id)} className="text-white/20 hover:text-white/60 text-xs">
              ✕
            </button>
          </li>
        ))}
        {blocks.length === 0 && (
          <li className="text-xs text-white/30 px-1 py-2">
            No blocks scheduled yet. Drag a Backlog task here to schedule it.
          </li>
        )}
      </ul>
      <form onSubmit={addBlock} className="flex gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-28 rounded-lg bg-base-800 border border-white/10 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Block label…"
          className="flex-1 rounded-lg bg-base-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button type="submit" className="px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm">
          Add
        </button>
      </form>
      {syncStatus && <p className="text-[11px] text-white/30 mt-2">{syncStatus}</p>}
    </div>
  );
}
