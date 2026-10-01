import { supabase } from "./supabaseClient";

export const STAGES = [
  { key: "intake_confirmed", label: "Intake" },
  { key: "sourcing", label: "Sourcing" },
  { key: "quoted", label: "Quoted" },
  { key: "awarded", label: "Awarded" },
  { key: "delivered", label: "Delivered" },
  // Closed without a win: the client declined our quotation, or it lapsed
  // (auto-rejected after QUOTE_EXPIRY_DAYS with no award).
  { key: "declined", label: "Declined", tone: "red" },
  { key: "rejected", label: "Rejected", tone: "red" },
];

export const QUOTE_EXPIRY_DAYS = 45;

const STAGE_KEYS = STAGES.map((s) => s.key);

export async function fetchPipelineRfqs() {
  const { data, error } = await supabase
    .from("rfqs")
    .select("id, rfq_number, title, closing_date, status, client_id, clients(name), rfq_lines(count)")
    .in("status", STAGE_KEYS)
    .order("closing_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(normalizeCard);
}

function normalizeCard(row) {
  return {
    id: row.id,
    rfqNumber: row.rfq_number,
    title: row.title,
    closingDate: row.closing_date,
    status: row.status,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "Unknown client",
    lineCount: row.rfq_lines?.[0]?.count ?? 0,
  };
}

export function urgencyFor(closingDate) {
  if (!closingDate) return "none";
  const endOfClosingDay = new Date(`${closingDate}T23:59:59`);
  const hoursLeft = (endOfClosingDay.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft <= 24) return "red";
  if (hoursLeft <= 72) return "amber";
  return "green";
}

export async function updateRfqStage(rfqId, status) {
  const { error } = await supabase.from("rfqs").update({ status }).eq("id", rfqId);
  if (error) throw error;
}

/**
 * Moves quoted RFQs to "rejected" when their latest quotation was sent more
 * than QUOTE_EXPIRY_DAYS ago, and records an rfq_alerts row for each so the
 * homepage can flag them. RFQs whose quotations have no sent_date are left
 * alone. Returns the rejected RFQ numbers.
 */
export async function autoRejectStaleQuotes() {
  const { data, error } = await supabase
    .from("rfqs")
    .select("id, rfq_number, title, quotations(sent_date)")
    .eq("status", "quoted");
  if (error) throw error;
  const cutoff = Date.now() - QUOTE_EXPIRY_DAYS * 86400000;
  const stale = (data ?? []).filter((r) => {
    const sent = (r.quotations ?? []).map((q) => q.sent_date).filter(Boolean).sort().pop();
    return sent && new Date(`${sent}T00:00:00+08:00`).getTime() < cutoff;
  });
  if (!stale.length) return [];
  const { error: updError } = await supabase
    .from("rfqs")
    .update({ status: "rejected" })
    .in("id", stale.map((r) => r.id))
    .eq("status", "quoted");
  if (updError) throw updError;
  const numbers = stale.map((r) => r.rfq_number || r.title);
  const { error: alertError } = await supabase
    .from("rfq_alerts")
    .insert(numbers.map((n) => ({ rfq_number: n, alert_type: "rejected" })));
  if (alertError) console.warn("[pipeline] recording rfq_alerts failed:", alertError.message);
  return numbers;
}

/** Realtime: react to any status change on rfqs, from anywhere in the app. */
export function subscribeToRfqChanges(onChange) {
  const channel = supabase
    .channel("pipeline-rfqs")
    .on("postgres_changes", { event: "*", schema: "public", table: "rfqs" }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
