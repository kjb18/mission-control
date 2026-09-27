import { useEffect, useState } from "react";
import { fetchInvoices, computeLedgerSummary, markInvoicePaid } from "../lib/ledger";
import { PageHeader, StatCard, Card, Badge, Button, DataTable, EmptyState } from "../components/ui";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const STATUS_VARIANT = {
  overdue: "red",
  current: "amber",
  paid: "green",
};

export default function Ledger() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    fetchInvoices()
      .then(setInvoices)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleMarkPaid(id) {
    setBusyId(id);
    setError(null);
    try {
      await markInvoicePaid(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const summary = computeLedgerSummary(invoices);

  const columns = [
    { key: "invoice_number", label: "Invoice #", render: (inv) => inv.invoice_number || "—" },
    { key: "clientName", label: "Client" },
    {
      key: "amount",
      label: "Amount (PHP)",
      render: (inv) => <span className="font-medium">{currency.format(inv.amount ?? 0)}</span>,
    },
    { key: "issued_date", label: "Invoice Date", render: (inv) => inv.issued_date || "—" },
    { key: "due_date", label: "Due Date", render: (inv) => inv.due_date || "—" },
    {
      key: "daysOverdue",
      label: "Days Overdue",
      render: (inv) => (inv.daysOverdue === null ? "—" : inv.daysOverdue),
    },
    {
      key: "agingStatus",
      label: "Status",
      render: (inv) => <Badge variant={STATUS_VARIANT[inv.agingStatus]}>{inv.agingStatus}</Badge>,
    },
    {
      key: "actions",
      label: "",
      render: (inv) =>
        inv.agingStatus !== "paid" && (
          <Button variant="secondary" disabled={busyId === inv.id} onClick={() => handleMarkPaid(inv.id)}>
            {busyId === inv.id ? "Saving…" : "Mark as Paid"}
          </Button>
        ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader title="Receivables Ageing" subtitle="Invoices, due dates, and who still owes what." />

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Outstanding" value={currency.format(summary.totalOutstanding)} />
        <StatCard label="Total Overdue" value={currency.format(summary.totalOverdue)} color="red" />
        <StatCard label="Overdue Invoices" value={summary.overdueCount} color="red" />
      </div>

      {!loading && invoices.length === 0 ? (
        <Card>
          <EmptyState title="No invoices yet" subtitle="Delivered RFQs create invoices automatically." />
        </Card>
      ) : (
        <Card noPadding className="overflow-x-auto">
          <DataTable columns={columns} rows={invoices} />
        </Card>
      )}
    </div>
  );
}
