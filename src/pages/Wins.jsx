import { useEffect, useState } from "react";
import { fetchWins, computeWinsSummary } from "../lib/wins";
import { PageHeader, StatCard, Card, DataTable, EmptyState } from "../components/ui";

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

  const columns = [
    {
      key: "client",
      label: "Client",
      render: (w) => (
        <div>
          <p className="font-medium">{w.client_name}</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            {w.rfq_reference || "No reference"} · Awarded {w.awarded_date}
          </p>
        </div>
      ),
    },
    {
      key: "value",
      label: "Value",
      render: (w) => (w.total_value ? currency.format(w.total_value) : "—"),
    },
    {
      key: "margin",
      label: "Margin",
      render: (w) => (
        <span className="text-emerald-700">
          {w.margin_percent !== null && w.margin_percent !== undefined
            ? `${Number(w.margin_percent).toFixed(1)}%`
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader title="Wins Log" subtitle="Automatically logged whenever an RFQ is awarded." />

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Wins" value={summary.totalCount} />
        <StatCard label={`Wins in ${new Date().getFullYear()}`} value={summary.countThisYear} />
        <StatCard label="Value This Year" value={currency.format(summary.totalValueThisYear)} color="blue" />
      </div>

      {!loading && wins.length === 0 ? (
        <Card>
          <EmptyState
            title="No wins yet"
            subtitle="They'll appear automatically once an RFQ is awarded."
          />
        </Card>
      ) : (
        <Card noPadding className="overflow-x-auto">
          <DataTable columns={columns} rows={wins} />
        </Card>
      )}
    </div>
  );
}
