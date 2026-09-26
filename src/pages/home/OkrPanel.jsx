import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOkrs, progressPercent } from "../../lib/okrs";

export default function OkrPanel() {
  const [okrs, setOkrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOkrs()
      .then(setOkrs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        <p className="text-sm font-semibold text-white">OKRs</p>
        <Link to="/okrs" className="ml-auto text-xs text-ink-muted hover:text-ink-secondary">
          View all →
        </Link>
      </div>

      <ul className="space-y-2 max-h-40 overflow-y-auto">
        {okrs.slice(0, 4).map((okr) => {
          const pct = progressPercent(okr);
          return (
            <li key={okr.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink-secondary truncate">{okr.objective}</span>
                <span className="text-ink-secondary shrink-0 ml-2">{pct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-base-800/60 overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
        {!loading && okrs.length === 0 && <li className="text-xs text-ink-muted px-1 py-1">No OKRs yet.</li>}
      </ul>
    </div>
  );
}
