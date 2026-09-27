import { StatCard } from "../../components/ui";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function TotalsPanel({ totals }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard label="Subtotal" value={currency.format(totals.subtotal)} />
      <StatCard label="VAT (12%)" value={currency.format(totals.vat)} />
      <StatCard label="Grand Total" value={currency.format(totals.grandTotal)} color="blue" />
      <StatCard label="Blended Margin" value={`${totals.blendedMarginPercent.toFixed(1)}%`} />
    </div>
  );
}
