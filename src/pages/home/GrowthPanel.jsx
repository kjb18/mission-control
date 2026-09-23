import { useState } from "react";
import { useLocalStorage } from "../../lib/useLocalStorage";

export default function GrowthPanel({ storageKey, title, accent, placeholder }) {
  const [items, setItems] = useLocalStorage(storageKey, []);
  const [draft, setDraft] = useState("");

  function addItem(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setItems([...items, { id: crypto.randomUUID(), text: draft.trim() }]);
    setDraft("");
  }

  function removeItem(id) {
    setItems(items.filter((i) => i.id !== id));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-base-900 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full ${accent}`} />
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="ml-auto text-xs text-white/30">{items.length}</span>
      </div>
      <ul className="space-y-1.5 mb-3 flex-1 max-h-52 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 bg-base-800 border border-white/10 rounded-lg px-3 py-2"
          >
            <span className="text-sm text-white/80 flex-1">{item.text}</span>
            <button
              onClick={() => removeItem(item.id)}
              className="text-white/20 hover:text-white/60 text-xs shrink-0"
            >
              ✕
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-white/30 px-1 py-1">Nothing here yet.</li>
        )}
      </ul>
      <form onSubmit={addItem} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg bg-base-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button type="submit" className="px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm">
          Add
        </button>
      </form>
    </div>
  );
}
