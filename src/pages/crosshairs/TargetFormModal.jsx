import { useState } from "react";
import Modal from "../../components/Modal";
import { PRIORITIES, createTarget, updateTarget, deleteTarget } from "../../lib/crosshairs";

const empty = {
  target_name: "",
  industry: "",
  priority: "Medium",
  estimated_value: "",
  primary_contact_name: "",
  current_stage: "",
  next_suggested_action: "",
  notes: "",
};

export default function TargetFormModal({ target, onClose, onSaved }) {
  const isEdit = Boolean(target);
  const [form, setForm] = useState(
    target
      ? {
          target_name: target.target_name ?? "",
          industry: target.industry ?? "",
          priority: target.priority ?? "Medium",
          estimated_value: target.estimated_value ?? "",
          primary_contact_name: target.primary_contact_name ?? "",
          current_stage: target.current_stage ?? "",
          next_suggested_action: target.next_suggested_action ?? "",
          notes: target.notes ?? "",
        }
      : empty
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.target_name.trim()) {
      setError("Target name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, estimated_value: form.estimated_value === "" ? null : Number(form.estimated_value) };
      if (isEdit) await updateTarget(target.id, payload);
      else await createTarget(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${target.target_name}? This also deletes its touchpoint history.`)) return;
    setSaving(true);
    try {
      await deleteTarget(target.id);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Target" : "New Target"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Target Name</span>
          <input value={form.target_name} onChange={(e) => update("target_name", e.target.value)} className="input" />
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
              value={form.estimated_value}
              onChange={(e) => update("estimated_value", e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Primary Contact</span>
            <input
              value={form.primary_contact_name}
              onChange={(e) => update("primary_contact_name", e.target.value)}
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
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-[10px] bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Target"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-[10px] bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm"
          >
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="ml-auto px-3 py-2 rounded-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-600 text-sm"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
