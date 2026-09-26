import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchWins, computeWinsSummary } from "../../lib/wins";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export default function WinsPanel() {
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWins({ limit: 4 })
      .then(setWins)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const summary = computeWinsSummary(wins);

  return (
    <div className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        <p className="text-sm font-semibold text-white">Wins</p>
        <span className="text-xs text-ink-muted">
          {summary.countThisYear} this yr · {currency.format(summary.totalValueThisYear)}
        </span>
        <Link to="/wins" className="ml-auto text-xs text-ink-muted hover:text-ink-secondary">
          View all →
        </Link>
      </div>

      <ul className="space-y-1.5">
        {wins.map((w) => (
          <li key={w.id} className="flex items-center justify-between text-xs bg-base-800 border border-line rounded-[10px] px-3 py-2">
            <span className="text-ink-secondary truncate">{w.client_name}</span>
            <span className="text-ink-secondary shrink-0 ml-2">
              {w.total_value ? currency.format(w.total_value) : "—"}
            </span>
          </li>
        ))}
        {!loading && wins.length === 0 && <li className="text-xs text-ink-muted px-1 py-1">No wins yet.</li>}
      </ul>
    </div>
  );
}
