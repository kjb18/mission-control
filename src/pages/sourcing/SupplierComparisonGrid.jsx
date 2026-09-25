import { landedCostPHP, unitPricePHP, daysToWeeks, FX_RATE_PHP, FREIGHT_DUTY_RATE } from "../../lib/sourcing";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function SupplierComparisonGrid({ quotes, line, onSelect, busy, fxRate = FX_RATE_PHP }) {
  if (quotes.length === 0) {
    return (
      <p className="text-sm text-ink-muted py-6 text-center">
        No supplier quotes yet for this line. Log a reply below or draft outreach.
      </p>
    );
  }

  const winningId = line?.winning_supplier_quote_id;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-secondary border-b border-line">
            <th className="py-2 pr-3">Supplier</th>
            <th className="py-2 pr-3">Brand</th>
            <th className="py-2 pr-3">Unit Price (PHP)</th>
            <th className="py-2 pr-3">Lead Time</th>
            <th className="py-2 pr-3">Certified</th>
            <th className="py-2 pr-3">Landed Cost</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const isWinner = winningId === q.id;
            return (
              <tr
                key={q.id}
                className={`border-b border-line ${isWinner ? "bg-emerald-400/5" : ""}`}
              >
                <td className="py-2.5 pr-3 text-white">
                  {q.supplierName}
                  {q.supplierBlacklisted && (
                    <span className="ml-2 text-[10px] text-red-300 bg-red-400/15 rounded-full px-1.5 py-0.5">
                      blacklisted
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-ink-secondary">{q.brand || "—"}</td>
                <td className="py-2.5 pr-3 text-white">{currency.format(unitPricePHP(q.unit_price, fxRate))}</td>
                <td className="py-2.5 pr-3 text-ink-secondary">
                  {daysToWeeks(q.lead_time_days) ?? "—"} wk
                </td>
                <td className="py-2.5 pr-3">
                  {q.certified ? (
                    <span className="text-emerald-300 text-xs">Yes</span>
                  ) : (
                    <span className="text-ink-muted text-xs">No</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-white font-medium">
                  {currency.format(landedCostPHP(q.unit_price, fxRate))}
                </td>
                <td className="py-2.5">
                  {isWinner ? (
                    <span className="text-xs text-emerald-300 font-medium">Selected</span>
                  ) : (
                    <button
                      onClick={() => onSelect(q.id)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 font-medium"
                    >
                      Select
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-white/25 mt-2">
        Landed cost = unit price × {fxRate} FX + {FREIGHT_DUTY_RATE * 100}% freight &amp; duties.
      </p>
    </div>
  );
}
