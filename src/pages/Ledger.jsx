import { useEffect, useState } from "react";
import { fetchInvoices, computeLedgerSummary, markInvoicePaid } from "../lib/ledger";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const STATUS_STYLES = {
  overdue: "text-red-300 bg-red-400/15",
  current: "text-orange-400 bg-orange-500/15",
  paid: "text-emerald-300 bg-emerald-400/15",
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

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">Ledger</p>
        <h1 className="text-2xl font-semibold text-white">Receivables Ageing</h1>
        <p className="text-sm text-ink-secondary mt-1">Invoices, due dates, and who still owes what.</p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <SummaryStat label="Total Outstanding" value={currency.format(summary.totalOutstanding)} />
        <SummaryStat label="Total Overdue" value={currency.format(summary.totalOverdue)} tone="text-red-300" />
        <SummaryStat label="Overdue Invoices" value={summary.overdueCount} tone="text-red-300" />
      </div>

      <div className="rounded-lg border border-line bg-base-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-secondary border-b border-line">
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Amount (PHP)</th>
              <th className="py-3 px-4">Invoice Date</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Days Overdue</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                className={`border-b border-line ${
                  inv.agingStatus === "overdue" ? "bg-red-500/[0.07]" : ""
                }`}
              >
                <td className="py-3 px-4 text-white">{inv.invoice_number || "—"}</td>
                <td className="py-3 px-4 text-ink-secondary">{inv.clientName}</td>
                <td className="py-3 px-4 text-white font-medium">{currency.format(inv.amount ?? 0)}</td>
                <td className="py-3 px-4 text-ink-secondary">{inv.issued_date || "—"}</td>
                <td className="py-3 px-4 text-ink-secondary">{inv.due_date || "—"}</td>
                <td className="py-3 px-4 text-ink-secondary">
                  {inv.daysOverdue === null ? "—" : inv.daysOverdue}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${STATUS_STYLES[inv.agingStatus]}`}
                  >
                    {inv.agingStatus}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {inv.agingStatus !== "paid" && (
                    <button
                      onClick={() => handleMarkPaid(inv.id)}
                      disabled={busyId === inv.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong disabled:opacity-50 text-white font-medium"
                    >
                      {busyId === inv.id ? "Saving…" : "Mark as Paid"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-ink-muted">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-lg border-[0.5px] border-line bg-base-900 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-ink-secondary">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
