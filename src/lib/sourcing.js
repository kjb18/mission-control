import { supabase } from "./supabaseClient";

export const FX_RATE_PHP = 57.8;
export const FREIGHT_DUTY_RATE = 0.12;

export function landedCostPHP(unitPrice) {
  const php = Number(unitPrice ?? 0) * FX_RATE_PHP;
  return php * (1 + FREIGHT_DUTY_RATE);
}

export function unitPricePHP(unitPrice) {
  return Number(unitPrice ?? 0) * FX_RATE_PHP;
}

export function daysToWeeks(days) {
  if (days === null || days === undefined) return null;
  return Math.round((days / 7) * 10) / 10;
}

export function weeksToDays(weeks) {
  return Math.round(Number(weeks) * 7);
}

export async function fetchIntakeConfirmedRfqs() {
  const { data, error } = await supabase
    .from("rfqs")
    .select("id, title, rfq_number, closing_date, status, client_id, clients(name)")
    .eq("status", "intake_confirmed")
    .order("closing_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, clientName: r.clients?.name ?? null }));
}

export async function fetchRfqLines(rfqId) {
  const { data, error } = await supabase
    .from("rfq_lines")
    .select("*")
    .eq("rfq_id", rfqId)
    .order("line_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, email, is_blacklisted")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSupplierQuotes(rfqLineId) {
  const { data, error } = await supabase
    .from("supplier_quotes")
    .select("*, suppliers(id, name, email, is_blacklisted)")
    .eq("rfq_line_id", rfqLineId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((q) => ({
    ...q,
    supplierName: q.suppliers?.name ?? "Unknown supplier",
    supplierBlacklisted: q.suppliers?.is_blacklisted ?? false,
  }));
}

async function resolveOrCreateSupplier(name) {
  const trimmed = name.trim();
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("suppliers")
    .insert({ name: trimmed })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

/** Task 5: manual supplier reply intake. */
export async function addManualQuote(rfqLineId, { supplierName, brand, unitPrice, leadTimeWeeks, certified }) {
  const supplierId = await resolveOrCreateSupplier(supplierName);
  const { error } = await supabase.from("supplier_quotes").insert({
    rfq_line_id: rfqLineId,
    supplier_id: supplierId,
    brand: brand || null,
    unit_price: unitPrice,
    lead_time_days: weeksToDays(leadTimeWeeks),
    certified: Boolean(certified),
    quoted_at: new Date().toISOString().slice(0, 10),
    status: "received",
  });
  if (error) throw error;
}

/** Task 1: pick the winning quote for a line. */
export async function selectSupplierQuote(rfqLineId, supplierQuoteId) {
  const { error } = await supabase
    .from("rfq_lines")
    .update({ status: "sourced", winning_supplier_quote_id: supplierQuoteId })
    .eq("id", rfqLineId);
  if (error) throw error;
}

/** Task 6: once every line on the RFQ is sourced, close out the RFQ stage. */
export async function maybeMarkRfqSourced(rfqId) {
  const lines = await fetchRfqLines(rfqId);
  if (lines.length === 0) return false;
  const allSourced = lines.every((l) => l.status === "sourced");
  if (!allSourced) return false;

  const { error } = await supabase.from("rfqs").update({ status: "sourced" }).eq("id", rfqId);
  if (error) throw error;
  return true;
}

/** Task 4: blacklist guard, checked fresh against the suppliers table every time. */
export async function checkSupplierBlacklist(name) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const { data } = await supabase
    .from("suppliers")
    .select("is_blacklisted")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.is_blacklisted);
}
