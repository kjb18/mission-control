import { supabase } from "./supabaseClient";

export const STAGES = [
  { key: "intake_confirmed", label: "Intake" },
  { key: "sourcing", label: "Sourcing" },
  { key: "quoted", label: "Quoted" },
  { key: "awarded", label: "Awarded" },
  { key: "delivered", label: "Delivered" },
];

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

/** Realtime: react to any status change on rfqs, from anywhere in the app. */
export function subscribeToRfqChanges(onChange) {
  const channel = supabase
    .channel("pipeline-rfqs")
    .on("postgres_changes", { event: "*", schema: "public", table: "rfqs" }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
