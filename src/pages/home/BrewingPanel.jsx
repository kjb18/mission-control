import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBrewingItems, createBrewingItem } from "../../lib/brewing";

export default function BrewingPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");

  function load() {
    fetchBrewingItems({ limit: 6 })
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function quickAdd(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    try {
      await createBrewingItem({ name: draft.trim() });
      setDraft("");
      load();
    } catch {
      // full Brewing page is always available for a retry
    }
  }

  return (
    <div className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <p className="text-sm font-semibold text-white">Brewing</p>
        <Link to="/brewing" className="ml-auto text-xs text-ink-muted hover:text-ink-secondary">
          Manage →
        </Link>
      </div>

      <ul className="space-y-1.5 mb-3 flex-1 max-h-40 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between text-xs bg-base-800 border border-line rounded-[10px] px-3 py-2"
          >
            <span className="text-ink-secondary truncate">{item.name}</span>
            <span className="text-ink-muted shrink-0 ml-2">{item.status}</span>
          </li>
        ))}
        {!loading && items.length === 0 && <li className="text-xs text-ink-muted px-1 py-1">Nothing here.</li>}
      </ul>
      <form onSubmit={quickAdd} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="An idea still forming…"
          className="flex-1 rounded-[10px] bg-base-800 border border-line px-3 py-2 text-sm text-white placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-violet-600"
        />
        <button type="submit" className="px-3 rounded-[10px] bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm">
          Add
        </button>
      </form>
    </div>
  );
}
