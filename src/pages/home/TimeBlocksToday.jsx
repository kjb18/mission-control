import { useState } from "react";
import { useLocalStorage } from "../../lib/useLocalStorage";
import { todayISODate } from "../../lib/dateUtils";

export default function TimeBlocksToday() {
  const [blocks, setBlocks] = useLocalStorage(`mc:timeblocks:${todayISODate()}`, []);
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");

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

  return (
    <div>
      <p className="text-xs font-medium text-white/50 mb-2">Today's Time Blocks</p>
      <ul className="space-y-1.5 mb-2 max-h-40 overflow-y-auto">
        {blocks.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-2 bg-base-800 border border-white/10 rounded-lg px-3 py-1.5"
          >
            <span className="text-xs font-mono text-accent w-14 shrink-0">{b.time}</span>
            <span className="text-sm text-white/80 flex-1">{b.label}</span>
            <button onClick={() => removeBlock(b.id)} className="text-white/20 hover:text-white/60 text-xs">
              ✕
            </button>
          </li>
        ))}
        {blocks.length === 0 && (
          <li className="text-xs text-white/30 px-1 py-1">No blocks scheduled yet.</li>
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
    </div>
  );
}
