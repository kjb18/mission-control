import { supabase } from "./supabaseClient";

export const FORWARDER_TYPES = ["Air Freight", "Sea Freight", "Land Transport", "Customs Broker", "Consolidator"];
export const FORWARDER_MODES = ["Air", "Sea LCL", "Sea FCL", "Land", "Door to Door"];
export const SERVICE_AREAS = ["Metro Manila", "Luzon", "Visayas", "Mindanao", "Nationwide"];
export const PAYMENT_TERMS = ["30 Days", "60 Days", "COD", "Upon Delivery", "Net 15"];
export const INCOTERMS = ["EXW", "FOB", "CIF", "DAP", "DDP", "FCA"];
export const CURRENCIES = ["PHP", "USD", "Both"];
export const STATUSES = ["active", "inactive", "blacklisted"];
export const PREFERRED_STATUSES = ["preferred", "backup"];

const RECENT_DAYS = 90;

export async function fetchForwarders() {
  const { data, error } = await supabase
    .from("logistics_forwarders")
    .select("*")
    .order("company_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createForwarder(fields) {
  const { data, error } = await supabase.from("logistics_forwarders").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateForwarder(id, fields) {
  const { data, error } = await supabase.from("logistics_forwarders").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteForwarder(id) {
  const { error } = await supabase.from("logistics_forwarders").delete().eq("id", id);
  if (error) throw error;
}

export const EMPTY_FORWARDER = {
  company_name: "",
  trading_name: "",
  type: [],
  status: "active",
  preferred_status: "backup",
  primary_contact: "",
  phone: "",
  email: "",
  account_manager: "",
  account_number: "",
  modes: [],
  ports_covered: "",
  service_areas: [],
  warehousing: false,
  customs_brokerage: false,
  payment_terms: "",
  incoterms: [],
  currency: "PHP",
  accreditation_number: "",
  insurance_details: "",
  first_used: "",
  last_used: "",
  rating: null,
  notes: "",
};

/** Form state -> row: blank strings become null (dates would otherwise fail to insert). */
export function toRow(form) {
  const row = {};
  for (const key of Object.keys(EMPTY_FORWARDER)) {
    const v = form[key];
    row[key] = typeof v === "string" ? v.trim() || null : v ?? null;
  }
  row.company_name = form.company_name.trim();
  return row;
}

/** Row -> form state: nulls become "" / [] so inputs stay controlled. */
export function toForm(row) {
  const form = { ...EMPTY_FORWARDER };
  for (const key of Object.keys(EMPTY_FORWARDER)) {
    const v = row?.[key];
    if (v !== null && v !== undefined) form[key] = v;
  }
  return form;
}

/** "DD MMM YYYY" from a YYYY-MM-DD date string, or "Never". */
export function formatLastUsed(date) {
  if (!date) return "Never";
  const [y, m, d] = String(date).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isRecentlyUsed(f, now = new Date()) {
  if (f.status !== "active" || !f.last_used) return false;
  const [y, m, d] = String(f.last_used).slice(0, 10).split("-").map(Number);
  const age = now.getTime() - new Date(y, m - 1, d).getTime();
  return age <= RECENT_DAYS * 86400000;
}

// Filter dropdowns use lowercase labels; stored values are title case.
export const matchesValue = (list, wanted) =>
  wanted === "all" || (list ?? []).some((v) => v.toLowerCase() === wanted);
