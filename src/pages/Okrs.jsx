import { useEffect, useState } from "react";
import { fetchOkrs, createOkr, updateOkr, deleteOkr, progressPercent } from "../lib/okrs";
import { PageHeader, Card, Button, EmptyState } from "../components/ui";

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
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="Objectives & Key Results"
        subtitle="Update current counts as progress happens."
        action={
          <Button variant="primary" className="!bg-violet-600" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New OKR"}
          </Button>
        }
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
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
            <Button type="submit" variant="primary" className="!bg-violet-600 col-span-2" disabled={saving}>
              {saving ? "Creating…" : "Create OKR"}
            </Button>
          </form>
        </Card>
      )}

      {!loading && okrs.length === 0 ? (
        <Card>
          <EmptyState title="No OKRs yet" subtitle="Add an objective to start tracking progress." />
        </Card>
      ) : (
        <div className="space-y-3">
          {okrs.map((okr) => {
            const pct = progressPercent(okr);
            return (
              <Card key={okr.id}>
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
                  <div className="h-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
