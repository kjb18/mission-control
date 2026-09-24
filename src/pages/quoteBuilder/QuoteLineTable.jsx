const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function QuoteLineTable({ lines, markups, onMarkupChange, computed }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-white/40 border-b border-white/10">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Description</th>
            <th className="py-2 pr-3">Qty</th>
            <th className="py-2 pr-3">Winning Supplier</th>
            <th className="py-2 pr-3">Landed Cost</th>
            <th className="py-2 pr-3">Markup %</th>
            <th className="py-2 pr-3">Sell Price</th>
            <th className="py-2 pr-3">Margin</th>
            <th className="py-2 pr-3">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const c = computed[line.id];
            return (
              <tr key={line.id} className="border-b border-white/5">
                <td className="py-2.5 pr-3 text-white/50">{i + 1}</td>
                <td className="py-2.5 pr-3 text-white/85 max-w-[220px]">{line.description}</td>
                <td className="py-2.5 pr-3 text-white/60">
                  {line.quantity} {line.unit}
                </td>
                <td className="py-2.5 pr-3 text-white/60">
                  {line.winning_quote?.suppliers?.name ?? "—"}
                </td>
                <td className="py-2.5 pr-3 text-white/70">{currency.format(c?.landedCost ?? 0)}</td>
                <td className="py-2.5 pr-3">
                  <input
                    type="number"
                    step="1"
                    value={markups[line.id] ?? ""}
                    onChange={(e) => onMarkupChange(line.id, e.target.value)}
                    className="w-20 rounded-lg bg-base-800 border border-white/10 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </td>
                <td className="py-2.5 pr-3 text-white font-medium">{currency.format(c?.sellPrice ?? 0)}</td>
                <td className="py-2.5 pr-3 text-emerald-300">{(c?.marginPercent ?? 0).toFixed(1)}%</td>
                <td className="py-2.5 pr-3 text-white font-semibold">{currency.format(c?.lineTotal ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
