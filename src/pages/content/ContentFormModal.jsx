import { useState } from "react";
import Modal from "../../components/Modal";
import { CONTENT_PLATFORMS, CONTENT_STATUSES, createContentItem, updateContentItem, deleteContentItem } from "../../lib/content";

export default function ContentFormModal({ item, defaultDate, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState(
    item
      ? {
          title: item.title ?? "",
          platform: item.platform ?? "Website",
          status: item.status ?? "Draft",
          scheduled_date: item.scheduled_date ?? "",
        }
      : { title: "", platform: "Website", status: "Draft", scheduled_date: defaultDate ?? "" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, scheduled_date: form.scheduled_date || null };
      if (isEdit) await updateContentItem(item.id, payload);
      else await createContentItem(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${item.title}"?`)) return;
    setSaving(true);
    try {
      await deleteContentItem(item.id);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Content Item" : "New Content Item"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Title</span>
          <input value={form.title} onChange={(e) => update("title", e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Platform</span>
            <select value={form.platform} onChange={(e) => update("platform", e.target.value)} className="input">
              {CONTENT_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Status</span>
            <select value={form.status} onChange={(e) => update("status", e.target.value)} className="input">
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Scheduled Date</span>
          <input
            type="date"
            value={form.scheduled_date}
            onChange={(e) => update("scheduled_date", e.target.value)}
            className="input"
          />
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm"
          >
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="ml-auto px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
