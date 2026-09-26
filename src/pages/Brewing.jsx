import { useEffect, useState } from "react";
import {
  fetchBrewingItems,
  createBrewingItem,
  updateBrewingItem,
  deleteBrewingItem,
  BREWING_CATEGORIES,
  BREWING_STATUSES,
} from "../lib/brewing";

const empty = { name: "", category: "Internal", status: "Idea", notes: "" };

const STATUS_STYLES = {
  Active: "text-emerald-700 bg-emerald-400/15",
  Planning: "text-blue-600 bg-blue-500/15",
  Draft: "text-ink-secondary bg-base-800/60",
  Scheduled: "text-blue-600 bg-blue-500/15",
  Idea: "text-orange-600 bg-orange-500/15",
};

export default function Brewing() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetchBrewingItems()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createBrewingItem({ ...form, name: form.name.trim() });
      setForm(empty);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(item, status) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)));
    try {
      await updateBrewingItem(item.id, { status });
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteBrewingItem(item.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-violet-600 font-medium mb-1">Brewing</p>
          <h1 className="text-2xl font-semibold text-white">What's Brewing</h1>
          <p className="text-sm text-ink-secondary mt-1">Ideas and initiatives still taking shape.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-[10px] bg-violet-600 hover:bg-violet-700 text-base-950 text-sm font-semibold shrink-0"
        >
          {showForm ? "Cancel" : "+ New Item"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5 space-y-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Name</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-ink-secondary mb-1">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="input"
              >
                {BREWING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-ink-secondary mb-1">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="input"
              >
                {BREWING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="input resize-none"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-[10px] bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white">{item.name}</p>
              <button onClick={() => handleDelete(item)} className="text-ink-muted hover:text-red-600 text-xs shrink-0">
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ink-secondary bg-base-800/60 rounded-full px-2 py-0.5">{item.category}</span>
              <select
                value={item.status}
                onChange={(e) => handleStatusChange(item, e.target.value)}
                className={`text-[11px] font-medium rounded-full px-2 py-0.5 bg-transparent border-0 focus:outline-none ${STATUS_STYLES[item.status]}`}
              >
                {BREWING_STATUSES.map((s) => (
                  <option key={s} value={s} className="bg-base-900 text-white">
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {item.notes && <p className="text-xs text-ink-secondary">{item.notes}</p>}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <p className="text-sm text-ink-muted col-span-full text-center py-10">Nothing brewing yet.</p>
        )}
      </div>
    </div>
  );
}
