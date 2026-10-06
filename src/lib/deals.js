import { supabase } from "./supabaseClient";

// Pipeline deals (migration 0024): one deal per RFQ. rfqs.status drives the
// Pipeline board; deals.status/stage mirror it and are what the Deal page edits.

// Colors follow the Pipeline columns (see STAGES in pipeline.js).
export const DEAL_STATUSES = [
  { key: "intake_confirmed", label: "Intake", fg: "#475569", bg: "#f1f5f9" },
  { key: "sourced", label: "Sourcing In Progress", fg: "#6d28d9", bg: "#ede9fe" },
  { key: "quoted", label: "Quoted", fg: "#1d4ed8", bg: "#dbeafe" },
  { key: "awarded", label: "Awarded", fg: "#15803d", bg: "#dcfce7" },
  { key: "delivered", label: "Delivered", fg: "#0f766e", bg: "#ccfbf1" },
  { key: "invoiced", label: "Invoiced", fg: "#4338ca", bg: "#e0e7ff" },
  { key: "rejected", label: "Rejected", fg: "#b91c1c", bg: "#fee2e2" },
  { key: "declined", label: "Declined", fg: "#b91c1c", bg: "#fee2e2" },
];

/** "sourcing" and "sourced" are one Pipeline column; anything unknown shows as Intake. */
export const dealStatusKey = (status) =>
  status === "sourcing" ? "sourced" : DEAL_STATUSES.some((s) => s.key === status) ? status : "intake_confirmed";

export const dealStatusMeta = (status) => DEAL_STATUSES.find((s) => s.key === dealStatusKey(status));

// "invoiced" isn't a Pipeline column, so an RFQ moved there would vanish from the board.
const PIPELINE_KEYS = new Set(DEAL_STATUSES.map((s) => s.key).filter((k) => k !== "invoiced"));
export const isPipelineStatus = (status) => PIPELINE_KEYS.has(status) || status === "sourcing";

let inflight = null;

/**
 * Creates a deal for every RFQ that has none and sets rfqs.deal_id. Idempotent
 * (RFQs with a deal_id are skipped) and safe to call concurrently: overlapping
 * calls share one run, and a unique index on deals.rfq_id backstops it.
 */
export function ensureDealsForRfqs() {
  if (!inflight) inflight = run().finally(() => (inflight = null));
  return inflight;
}

async function run() {
  const { data: rfqs, error } = await supabase
    .from("rfqs")
    .select("id, rfq_number, title, status, received_date, closing_date, notes, clients(name)")
    .is("deal_id", null);
  if (error) throw error;
  if (!rfqs?.length) return 0;

  const fetchExisting = async () => {
    const found = [];
    for (let i = 0; i < rfqs.length; i += 100) {
      const { data } = await supabase.from("deals").select("id, rfq_id").in("rfq_id", rfqs.slice(i, i + 100).map((r) => r.id));
      found.push(...(data ?? []));
    }
    return found;
  };

  // A deal may exist already (an earlier run died before linking the RFQ).
  const dealByRfq = new Map((await fetchExisting()).map((d) => [d.rfq_id, d.id]));
  const toCreate = rfqs.filter((r) => !dealByRfq.has(r.id));
  if (toCreate.length) {
    const { data: created, error: insertError } = await supabase
      .from("deals")
      .insert(
        toCreate.map((r) => ({
          rfq_id: r.id,
          rfq_number: r.rfq_number,
          client_name: r.clients?.name ?? null,
          title: r.title,
          status: r.status,
          stage: r.status,
          received_date: r.received_date,
          closing_date: r.closing_date,
          notes: r.notes,
        }))
      )
      .select("id, rfq_id");
    if (insertError) {
      if (insertError.code !== "23505") throw insertError;
      // Lost a race with another tab: pick up what it created.
      (await fetchExisting()).forEach((d) => dealByRfq.set(d.rfq_id, d.id));
    } else {
      created.forEach((d) => dealByRfq.set(d.rfq_id, d.id));
    }
  }

  const results = await Promise.all(
    rfqs.filter((r) => dealByRfq.has(r.id)).map((r) => supabase.from("rfqs").update({ deal_id: dealByRfq.get(r.id) }).eq("id", r.id).is("deal_id", null))
  );
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  return dealByRfq.size;
}

/** Mirrors an RFQ status change onto its deal. */
export async function syncDealStatus(rfqId, status) {
  const { error } = await supabase
    .from("deals")
    .update({ status, stage: status, stage_changed_at: new Date().toISOString() })
    .eq("rfq_id", rfqId);
  if (error) console.warn("[deals] status sync failed:", error.message);
}
