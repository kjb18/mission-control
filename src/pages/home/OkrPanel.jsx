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
    <div className="rounded-2xl border border-white/10 bg-base-900 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        <p className="text-sm font-semibold text-white">OKRs</p>
        <Link to="/okrs" className="ml-auto text-xs text-white/30 hover:text-white/60">
          View all →
        </Link>
      </div>

      <ul className="space-y-2 max-h-40 overflow-y-auto">
        {okrs.slice(0, 4).map((okr) => {
          const pct = progressPercent(okr);
          return (
            <li key={okr.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-white/70 truncate">{okr.objective}</span>
                <span className="text-white/40 shrink-0 ml-2">{pct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-sky-400" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
        {!loading && okrs.length === 0 && <li className="text-xs text-white/30 px-1 py-1">No OKRs yet.</li>}
      </ul>
    </div>
  );
}
