import { DataTable } from "../../components/ui";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function QuoteLineTable({ lines, markups, onMarkupChange, computed }) {
  const rows = lines.map((line, i) => ({ ...line, _index: i, _computed: computed[line.id] }));

  const columns = [
    { key: "index", label: "#", render: (row) => row._index + 1 },
    {
      key: "description",
      label: "Description",
      render: (row) => <span className="max-w-[220px] inline-block truncate align-bottom">{row.description}</span>,
    },
    { key: "qty", label: "Qty", render: (row) => `${row.quantity} ${row.unit}` },
    {
      key: "supplier",
      label: "Winning Supplier",
      render: (row) => row.winning_quote?.suppliers?.name ?? "—",
    },
    {
      key: "landed",
      label: "Landed Cost",
      render: (row) => currency.format(row._computed?.landedCost ?? 0),
    },
    {
      key: "markup",
      label: "Markup %",
      render: (row) => (
        <input
          type="number"
          step="1"
          value={markups[row.id] ?? ""}
          onChange={(e) => onMarkupChange(row.id, e.target.value)}
          className="w-20 rounded-[10px] bg-base-800 border border-line px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
        />
      ),
    },
    {
      key: "sell",
      label: "Sell Price",
      render: (row) => <span className="font-medium">{currency.format(row._computed?.sellPrice ?? 0)}</span>,
    },
    {
      key: "margin",
      label: "Margin",
      render: (row) => (
        <span className="text-emerald-700">{(row._computed?.marginPercent ?? 0).toFixed(1)}%</span>
      ),
    },
    {
      key: "total",
      label: "Line Total",
      render: (row) => <span className="font-semibold">{currency.format(row._computed?.lineTotal ?? 0)}</span>,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
