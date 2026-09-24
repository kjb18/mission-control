import { supabase } from "./supabaseClient";

function normalizeDescription(description) {
  return (description ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolvePartSignatureId(rfqLine) {
  if (rfqLine.part_signature_id) return rfqLine.part_signature_id;

  const normalized = normalizeDescription(rfqLine.description);
  if (!normalized) return null;

  const { data } = await supabase.rpc("match_part_signatures", {
    search_text: normalized,
    match_limit: 1,
    min_similarity: 0.25,
  });
  return data?.[0]?.id ?? null;
}

/**
 * Task 3: last three quotes on the same part signature, across any RFQ,
 * with supplier name, price, lead time, and win/loss relative to whichever
 * quote each historical line eventually selected.
 */
export async function fetchPriceHistory(rfqLine) {
  const partSignatureId = await resolvePartSignatureId(rfqLine);
  if (!partSignatureId) return [];

  const { data: lines } = await supabase
    .from("rfq_lines")
    .select("id, winning_supplier_quote_id")
    .eq("part_signature_id", partSignatureId)
    .neq("id", rfqLine.id);

  const lineIds = (lines ?? []).map((l) => l.id);
  if (lineIds.length === 0) return [];

  const winningIdByLine = Object.fromEntries((lines ?? []).map((l) => [l.id, l.winning_supplier_quote_id]));

  const { data: quotes } = await supabase
    .from("supplier_quotes")
    .select("id, rfq_line_id, unit_price, lead_time_days, quoted_at, suppliers(name)")
    .in("rfq_line_id", lineIds)
    .order("quoted_at", { ascending: false })
    .limit(3);

  return (quotes ?? []).map((q) => {
    const winningId = winningIdByLine[q.rfq_line_id];
    const outcome = !winningId ? "pending" : winningId === q.id ? "won" : "lost";
    return {
      id: q.id,
      supplierName: q.suppliers?.name ?? "Unknown supplier",
      unitPrice: q.unit_price,
      leadTimeDays: q.lead_time_days,
      quotedAt: q.quoted_at,
      outcome,
    };
  });
}
