import { useState } from "react";
import Modal from "../../components/Modal";
import { PRIORITIES, updateTarget, removeFromCrosshairs } from "../../lib/crosshairs";
import { Button } from "../../components/ui";

export default function TargetFormModal({ target, onClose, onSaved }) {
  // A target is a company on Crosshairs; new ones come from "+ Add to Crosshairs".
  const [form, setForm] = useState({
    name: target.name ?? "",
    industry: target.industry ?? "",
    priority: target.priority ?? "Medium",
    estimated_deal_value: target.estimated_deal_value ?? "",
    current_stage: target.current_stage ?? "",
    next_suggested_action: target.next_suggested_action ?? "",
    notes: target.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTarget(target.id, {
        name: form.name.trim(),
        industry: form.industry.trim() || null,
        priority: form.priority,
        estimated_deal_value: form.estimated_deal_value === "" ? null : Number(form.estimated_deal_value),
        current_stage: form.current_stage.trim() || null,
        next_suggested_action: form.next_suggested_action.trim() || null,
        notes: form.notes.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove ${target.name} from Crosshairs? The company stays in Companies.`)) return;
    setSaving(true);
    try {
      await removeFromCrosshairs(target.id);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Target" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Company Name</span>
          <input value={form.name} onChange={(e) => update("name", e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Industry</span>
            <input value={form.industry} onChange={(e) => update("industry", e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Priority</span>
            <select value={form.priority} onChange={(e) => update("priority", e.target.value)} className="input">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Estimated Value (PHP)</span>
            <input
              type="number"
              step="0.01"
              value={form.estimated_deal_value}
              onChange={(e) => update("estimated_deal_value", e.target.value)}
              className="input"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Current Stage</span>
          <input value={form.current_stage} onChange={(e) => update("current_stage", e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Next Suggested Action</span>
          <input
            value={form.next_suggested_action}
            onChange={(e) => update("next_suggested_action", e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Notes</span>
          <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} className="input resize-none" />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="primary" className="!bg-violet-600" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="danger" className="ml-auto !bg-red-500/10 !text-red-600" onClick={handleDelete} disabled={saving}>
            Remove from Crosshairs
          </Button>
        </div>
      </form>
    </Modal>
  );
}
