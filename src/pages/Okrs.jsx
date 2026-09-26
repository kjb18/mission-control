import { useEffect, useState } from "react";
import { fetchOkrs, createOkr, updateOkr, deleteOkr, progressPercent } from "../lib/okrs";

const empty = { objective: "", target_number: "", current_count: "0", unit_label: "", quarter: "" };

export default function Okrs() {
  const [okrs, setOkrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetchOkrs()
      .then(setOkrs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCountChange(okr, value) {
    const next = okrs.map((o) => (o.id === okr.id ? { ...o, current_count: value } : o));
    setOkrs(next);
    try {
      await updateOkr(okr.id, { current_count: Number(value) || 0 });
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.objective.trim() || !form.target_number) {
      setError("Title and target number are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createOkr({
        objective: form.objective.trim(),
        target_number: Number(form.target_number),
        current_count: Number(form.current_count) || 0,
        unit_label: form.unit_label.trim() || null,
        quarter: form.quarter.trim() || null,
      });
      setForm(empty);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(okr) {
    if (!confirm(`Delete "${okr.objective}"?`)) return;
    try {
      await deleteOkr(okr.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-violet-600 font-medium mb-1">OKRs</p>
          <h1 className="text-2xl font-semibold text-white">Objectives & Key Results</h1>
          <p className="text-sm text-ink-secondary mt-1">Update current counts as progress happens.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-[10px] bg-violet-600 hover:bg-violet-700 text-base-950 text-sm font-semibold shrink-0"
        >
          {showForm ? "Cancel" : "+ New OKR"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5 grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="block text-xs text-ink-secondary mb-1">Title</span>
            <input
              value={form.objective}
              onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Target Number</span>
            <input
              type="number"
              value={form.target_number}
              onChange={(e) => setForm((f) => ({ ...f, target_number: e.target.value }))}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Current Count</span>
            <input
              type="number"
              value={form.current_count}
              onChange={(e) => setForm((f) => ({ ...f, current_count: e.target.value }))}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Unit Label</span>
            <input
              value={form.unit_label}
              onChange={(e) => setForm((f) => ({ ...f, unit_label: e.target.value }))}
              placeholder="clients, articles…"
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Quarter</span>
            <input
              value={form.quarter}
              onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}
              placeholder="Q2"
              className="input"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="col-span-2 px-4 py-2 rounded-[10px] bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Creating…" : "Create OKR"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {okrs.map((okr) => {
          const pct = progressPercent(okr);
          return (
            <div key={okr.id} className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{okr.objective}</p>
                  {okr.quarter && <p className="text-xs text-ink-secondary">{okr.quarter}</p>}
                </div>
                <button
                  onClick={() => handleDelete(okr)}
                  className="text-xs text-ink-muted hover:text-red-600 shrink-0"
                >
                  Delete
                </button>
              </div>

              <div className="w-full h-2 rounded-full bg-base-800/60 overflow-hidden mb-2">
                <div
                  className="h-full bg-violet-600 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={okr.current_count ?? 0}
                    onChange={(e) => handleCountChange(okr, e.target.value)}
                    className="w-20 rounded-[10px] bg-base-800 border border-line px-2 py-1 text-sm text-white"
                  />
                  <span className="text-ink-secondary">
                    / {okr.target_number} {okr.unit_label}
                  </span>
                </div>
                <span className="text-violet-600 font-medium">{pct}%</span>
              </div>
            </div>
          );
        })}
        {!loading && okrs.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-10">No OKRs yet.</p>
        )}
      </div>
    </div>
  );
}
