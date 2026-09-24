import { supabase } from "./supabaseClient";

// Fallback only — the live rate comes from app_settings (src/lib/settings.js)
// and should be threaded through wherever these are called.
export const FX_RATE_PHP = 57.8;
export const FREIGHT_DUTY_RATE = 0.12;

export function landedCostPHP(unitPrice, fxRate = FX_RATE_PHP) {
  const php = Number(unitPrice ?? 0) * fxRate;
  return php * (1 + FREIGHT_DUTY_RATE);
}

export function unitPricePHP(unitPrice, fxRate = FX_RATE_PHP) {
  return Number(unitPrice ?? 0) * fxRate;
}

export function daysToWeeks(days) {
  if (days === null || days === undefined) return null;
  return Math.round((days / 7) * 10) / 10;
}

export function weeksToDays(weeks) {
  return Math.round(Number(weeks) * 7);
}

/** RFQs still on the Sourcing Desk: not yet started, or in progress. */
export async function fetchSourcingDeskRfqs() {
  const { data, error } = await supabase
    .from("rfqs")
    .select("id, title, rfq_number, closing_date, status, client_id, clients(name)")
    .in("status", ["intake_confirmed", "sourcing"])
    .order("closing_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, clientName: r.clients?.name ?? null }));
}

/** Bumps intake_confirmed -> sourcing the moment work actually starts. */
async function ensureRfqInSourcing(rfqLineId) {
  const { data: line } = await supabase
    .from("rfq_lines")
    .select("rfq_id")
    .eq("id", rfqLineId)
    .single();
  if (!line) return;

  await supabase
    .from("rfqs")
    .update({ status: "sourcing" })
    .eq("id", line.rfq_id)
    .eq("status", "intake_confirmed");
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
  await ensureRfqInSourcing(rfqLineId);
}

/** Task 1: pick the winning quote for a line. */
export async function selectSupplierQuote(rfqLineId, supplierQuoteId) {
  const { error } = await supabase
    .from("rfq_lines")
    .update({ status: "sourced", winning_supplier_quote_id: supplierQuoteId })
    .eq("id", rfqLineId);
  if (error) throw error;
  await ensureRfqInSourcing(rfqLineId);
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

/** Settings → Blacklist manager. */
export async function fetchBlacklistedSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("is_blacklisted", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function addSupplierToBlacklist(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("suppliers").update({ is_blacklisted: true }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("suppliers").insert({ name: trimmed, is_blacklisted: true });
    if (error) throw error;
  }
}

export async function removeSupplierFromBlacklist(id) {
  const { error } = await supabase.from("suppliers").update({ is_blacklisted: false }).eq("id", id);
  if (error) throw error;
}
