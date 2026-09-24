import { supabase } from "./supabaseClient";

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(name)")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(withAging);
}

function withAging(invoice) {
  const clientName = invoice.clients?.name ?? "Unknown client";
  const isPaid = invoice.status === "paid" || Boolean(invoice.paid_date);

  let daysOverdue = null;
  let agingStatus = "paid";
  if (!isPaid) {
    if (invoice.due_date) {
      const due = new Date(`${invoice.due_date}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      daysOverdue = Math.round((today - due) / (1000 * 60 * 60 * 24));
      agingStatus = daysOverdue > 0 ? "overdue" : "current";
    } else {
      agingStatus = "current";
    }
  }

  return { ...invoice, clientName, daysOverdue, agingStatus };
}

export function computeLedgerSummary(invoices) {
  const outstanding = invoices.filter((i) => i.agingStatus !== "paid");
  const overdue = invoices.filter((i) => i.agingStatus === "overdue");
  return {
    totalOutstanding: outstanding.reduce((sum, i) => sum + Number(i.amount ?? 0), 0),
    totalOverdue: overdue.reduce((sum, i) => sum + Number(i.amount ?? 0), 0),
    overdueCount: overdue.length,
  };
}

export async function markInvoicePaid(invoiceId) {
  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10) })
    .eq("id", invoiceId);
  if (error) throw error;
}
