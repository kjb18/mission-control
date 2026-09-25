import { useEffect, useState } from "react";
import { fetchWins, computeWinsSummary } from "../lib/wins";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function Wins() {
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWins()
      .then(setWins)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const summary = computeWinsSummary(wins);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">Wins</p>
        <h1 className="text-2xl font-semibold text-white">Wins Log</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Automatically logged whenever an RFQ is awarded.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat label="Total Wins" value={summary.totalCount} />
        <Stat label={`Wins in ${new Date().getFullYear()}`} value={summary.countThisYear} />
        <Stat label="Value This Year" value={currency.format(summary.totalValueThisYear)} tone="text-accent" />
      </div>

      <div className="rounded-lg border border-line bg-base-900 divide-y divide-line">
        {wins.map((w) => (
          <div key={w.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-white">{w.client_name}</p>
              <p className="text-xs text-ink-secondary">
                {w.rfq_reference || "No reference"} · Awarded {w.awarded_date}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">
                {w.total_value ? currency.format(w.total_value) : "—"}
              </p>
              <p className="text-xs text-emerald-300">
                {w.margin_percent !== null && w.margin_percent !== undefined
                  ? `${Number(w.margin_percent).toFixed(1)}% margin`
                  : ""}
              </p>
            </div>
          </div>
        ))}
        {!loading && wins.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-10">
            No wins yet — they'll appear automatically once an RFQ is awarded.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-lg border-[0.5px] border-line bg-base-900 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-ink-secondary">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
