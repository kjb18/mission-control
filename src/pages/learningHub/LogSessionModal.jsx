import { useState } from "react";
import Modal from "../../components/Modal";
import { logSession, computeNextStreak } from "../../lib/learningHub";

export default function LogSessionModal({ topic, onClose, onSaved }) {
  const [progress, setProgress] = useState(topic.progress_percent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const nextStreak = computeNextStreak(topic);
  const gapResetWarning = topic.last_session_date && nextStreak === 1 && (topic.current_streak ?? 0) > 1;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await logSession(topic.id, { progressPercent: progress });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Log Session — ${topic.title}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-[10px] bg-base-800 border border-line px-3 py-2 text-sm text-ink-secondary">
          Streak: {topic.current_streak} → <span className="text-accent font-medium">{nextStreak}</span> day
          {nextStreak === 1 ? "" : "s"}
          {gapResetWarning && (
            <span className="block text-xs text-orange-600/80 mt-1">A day was skipped — streak resets to 1.</span>
          )}
        </div>

        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Progress (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            className="input"
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-[10px] bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Saving…" : "Log Session"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-[10px] bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
