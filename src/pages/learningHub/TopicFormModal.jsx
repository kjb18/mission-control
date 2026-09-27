import { useState } from "react";
import Modal from "../../components/Modal";
import { createTopic, updateTopic, deleteTopic } from "../../lib/learningHub";
import { Button } from "../../components/ui";

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

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Topic"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {isEdit && (
            <Button type="button" variant="danger" className="ml-auto !bg-red-500/10 !text-red-600" onClick={handleDelete} disabled={saving}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
