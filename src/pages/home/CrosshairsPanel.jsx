import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTargets, fetchTodaysRotatedTarget, logTouchpoint } from "../../lib/crosshairs";
import { todayISODate } from "../../lib/dateUtils";

export default function CrosshairsPanel() {
  const [rotated, setRotated] = useState(null);
  const [rest, setRest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([fetchTodaysRotatedTarget(), fetchTargets()])
      .then(([rotatedTarget, all]) => {
        setRotated(rotatedTarget);
        setRest(rotatedTarget ? all.filter((t) => t.id !== rotatedTarget.id) : all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function quickLog(target) {
    setLogging(true);
    try {
      await logTouchpoint(target.id, { date: todayISODate(), note: "Logged from homepage" });
      load();
    } catch {
      // best-effort; the full Crosshairs page is always available
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="rounded-lg border-[0.5px] border-line bg-base-900 px-3 py-2.5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        <p className="text-sm font-semibold text-white">Crosshairs</p>
        <Link to="/crosshairs" className="ml-auto text-xs text-ink-muted hover:text-ink-secondary">
          View all →
        </Link>
      </div>

      {loading ? (
        <p className="text-xs text-ink-muted">Loading…</p>
      ) : !rotated ? (
        <p className="text-xs text-ink-muted">No targets yet.</p>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white font-medium truncate">{rotated.target_name}</p>
              <span className="text-[10px] uppercase tracking-wide text-accent shrink-0">{rotated.priority}</span>
            </div>
            <p className="text-[11px] text-ink-secondary mt-0.5">
              {rotated.next_suggested_action || "No suggested action set."}
            </p>
            <button
              onClick={() => quickLog(rotated)}
              disabled={logging}
              className="mt-1.5 text-[11px] px-2 py-1 rounded-md bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 font-medium"
            >
              Log Touchpoint
            </button>
          </div>

          <ul className="space-y-1 max-h-28 overflow-y-auto">
            {rest.slice(0, 4).map((t) => (
              <li key={t.id} className="flex items-center justify-between text-xs px-1 py-1">
                <span className="text-ink-secondary truncate">{t.target_name}</span>
                <span className="text-ink-muted shrink-0 ml-2">{t.priority}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
