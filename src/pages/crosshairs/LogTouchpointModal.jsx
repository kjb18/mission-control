import { useState } from "react";
import Modal from "../../components/Modal";
import { logTouchpoint } from "../../lib/crosshairs";
import { todayISODate } from "../../lib/dateUtils";
import { Button } from "../../components/ui";

export default function LogTouchpointModal({ target, onClose, onSaved }) {
  const [date, setDate] = useState(todayISODate());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await logTouchpoint(target.id, { date, note: note.trim() || null });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Log Touchpoint — ${target.target_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What happened?"
            className="input resize-none"
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="primary" className="!bg-violet-600" disabled={saving}>
            {saving ? "Saving…" : "Log Touchpoint"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
