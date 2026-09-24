import { useState } from "react";
import Modal from "../../components/Modal";
import { SEO_STATUSES, createArticle, updateArticle, deleteArticle } from "../../lib/seo";

const empty = { title: "", target_keyword: "", status: "Draft", publish_date: "", word_count: "", url: "" };

export default function ArticleFormModal({ article, onClose, onSaved }) {
  const isEdit = Boolean(article);
  const [form, setForm] = useState(
    article
      ? {
          title: article.title ?? "",
          target_keyword: article.target_keyword ?? "",
          status: article.status ?? "Draft",
          publish_date: article.publish_date ?? "",
          word_count: article.word_count ?? "",
          url: article.url ?? "",
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
      const payload = {
        ...form,
        publish_date: form.publish_date || null,
        word_count: form.word_count === "" ? null : Number(form.word_count),
      };
      if (isEdit) await updateArticle(article.id, payload);
      else await createArticle(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${article.title}"?`)) return;
    setSaving(true);
    try {
      await deleteArticle(article.id);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Article" : "New Article"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="block text-xs text-white/40 mb-1">Article Title</span>
          <input value={form.title} onChange={(e) => update("title", e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs text-white/40 mb-1">Target Keyword</span>
          <input value={form.target_keyword} onChange={(e) => update("target_keyword", e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Status</span>
            <select value={form.status} onChange={(e) => update("status", e.target.value)} className="input">
              {SEO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Publish Date</span>
            <input type="date" value={form.publish_date} onChange={(e) => update("publish_date", e.target.value)} className="input" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Word Count</span>
            <input type="number" value={form.word_count} onChange={(e) => update("word_count", e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">URL</span>
            <input value={form.url} onChange={(e) => update("url", e.target.value)} className="input" />
          </label>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Article"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm"
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
