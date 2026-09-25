const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function TotalsPanel({ totals }) {
  return (
    <div className="rounded-lg border-2 border-line-strong bg-base-900 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Stat label="Subtotal" value={currency.format(totals.subtotal)} />
      <Stat label="VAT (12%)" value={currency.format(totals.vat)} />
      <Stat label="Grand Total" value={currency.format(totals.grandTotal)} highlight />
      <Stat label="Blended Margin" value={`${totals.blendedMarginPercent.toFixed(1)}%`} />
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-secondary">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${highlight ? "text-accent" : "text-white"}`}>{value}</p>
    </div>
  );
}
