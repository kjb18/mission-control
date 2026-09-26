import { daysToWeeks } from "../../lib/sourcing";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const OUTCOME_STYLES = {
  won: "text-emerald-700 bg-emerald-400/15",
  lost: "text-ink-secondary bg-base-800/60",
  pending: "text-orange-600 bg-orange-500/15",
};

export default function PriceHistoryPanel({ history, loading }) {
  if (loading) return <p className="text-sm text-ink-muted">Loading history…</p>;
  if (history.length === 0) {
    return <p className="text-sm text-ink-muted">No prior quotes found for this part.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {history.map((h) => (
        <li
          key={h.id}
          className="flex items-center justify-between bg-base-800 border border-line rounded-[10px] px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-white">{h.supplierName}</span>
            <span className="text-ink-secondary text-xs">{currency.format(h.unitPrice ?? 0)}</span>
            <span className="text-ink-secondary text-xs">{daysToWeeks(h.leadTimeDays) ?? "—"} wk</span>
          </div>
          <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${OUTCOME_STYLES[h.outcome]}`}>
            {h.outcome}
          </span>
        </li>
      ))}
    </ul>
  );
}
