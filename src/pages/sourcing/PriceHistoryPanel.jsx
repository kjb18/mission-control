import { daysToWeeks } from "../../lib/sourcing";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const OUTCOME_STYLES = {
  won: "text-emerald-300 bg-emerald-400/15",
  lost: "text-white/40 bg-white/5",
  pending: "text-amber-300 bg-amber-400/15",
};

export default function PriceHistoryPanel({ history, loading }) {
  if (loading) return <p className="text-sm text-white/30">Loading history…</p>;
  if (history.length === 0) {
    return <p className="text-sm text-white/30">No prior quotes found for this part.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {history.map((h) => (
        <li
          key={h.id}
          className="flex items-center justify-between bg-base-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-white/80">{h.supplierName}</span>
            <span className="text-white/40 text-xs">{currency.format(h.unitPrice ?? 0)}</span>
            <span className="text-white/40 text-xs">{daysToWeeks(h.leadTimeDays) ?? "—"} wk</span>
          </div>
          <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${OUTCOME_STYLES[h.outcome]}`}>
            {h.outcome}
          </span>
        </li>
      ))}
    </ul>
  );
}
