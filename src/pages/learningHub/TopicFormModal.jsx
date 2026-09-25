import { useState } from "react";
import Modal from "../../components/Modal";
import { createTopic, updateTopic, deleteTopic } from "../../lib/learningHub";

const empty = { title: "", category: "", description: "", status: "active" };

export default function TopicFormModal({ topic, onClose, onSaved }) {
  const isEdit = Boolean(topic);
  const [form, setForm] = useState(
    topic
      ? {
          title: topic.title ?? "",
          category: topic.category ?? "",
          description: topic.description ?? "",
          status: topic.status ?? "active",
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
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) await updateTopic(topic.id, form);
      else await createTopic(form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${topic.title}"?`)) return;
    setSaving(true);
    try {
      await deleteTopic(topic.id);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Topic" : "New Topic"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Title</span>
          <input value={form.title} onChange={(e) => update("title", e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Category</span>
            <input value={form.category} onChange={(e) => update("category", e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Status</span>
            <select value={form.status} onChange={(e) => update("status", e.target.value)} className="input">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="input resize-none"
          />
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Topic"}
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
