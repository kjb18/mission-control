import { supabase } from "./supabaseClient";
import { parseCsv } from "./contactsCsv";
import { manilaToday } from "./dateUtils";

// CRM companies (migration 0028): one directory shared by People, Pipeline deals,
// Planning projects and Crosshairs.

export const COMPANY_TYPES = [
  "Client",
  "Prospect",
  "Principal",
  "Supplier",
  "Competitor",
  "Service Provider",
  "Association",
  "Government",
  "Partner",
];
export const COMPANY_STATUSES = ["active", "inactive", "blacklisted"];
export const ACCOUNT_TIERS = ["A", "B", "C"];
export const PRIORITIES = ["Hot", "Medium", "Low", "Nurturing"];
export const INTERACTION_TYPES = ["call", "email", "visit", "whatsapp", "meeting", "other"];
export const CONTACT_TYPES = [
  "Decision Maker",
  "Technical Buyer",
  "Procurement Officer",
  "End User",
  "Champion",
  "Gatekeeper",
  "Supplier Rep",
  "Competitor Contact",
  "Personal",
];
export const RELATIONSHIP_STRENGTHS = ["Strong", "Active", "Secondary", "Inactive"];

export const EMPTY_COMPANY = {
  name: "",
  trading_name: "",
  types: [],
  industry: "",
  website: "",
  address: "",
  tin: "",
  account_tier: "",
  relationship_owner: "Khalil Joseph Banares",
  first_engagement_date: "",
  notes: "",
  known_products: "",
  known_clients: "",
  known_pricing: "",
  strengths: "",
  weaknesses: "",
  crosshairs_active: false,
  priority: "",
  last_touchpoint_date: "",
  next_suggested_action: "",
  estimated_deal_value: "",
  current_stage: "",
  status: "active",
};

/** Form state -> row: blank strings become null (dates and numerics would otherwise fail). */
export function toRow(form) {
  const row = {};
  for (const key of Object.keys(EMPTY_COMPANY)) {
    const v = form[key];
    row[key] = typeof v === "string" ? v.trim() || null : v ?? null;
  }
  row.name = form.name.trim();
  row.status = form.status || "active";
  row.estimated_deal_value = row.estimated_deal_value == null ? null : Number(row.estimated_deal_value);
  return row;
}

/** Row -> form state: nulls become "" / [] so inputs stay controlled. */
export function toForm(row) {
  const form = { ...EMPTY_COMPANY };
  for (const key of Object.keys(EMPTY_COMPANY)) {
    const v = row?.[key];
    if (v !== null && v !== undefined) form[key] = v;
  }
  return form;
}

// ---- Queries --------------------------------------------------------------------------

export async function fetchCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("*, contacts(count)")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, contact_count: c.contacts?.[0]?.count ?? 0 }));
}

/** Just id + name, for pickers. */
export async function fetchCompanyOptions() {
  const { data, error } = await supabase.from("companies").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createCompany(fields) {
  const { data, error } = await supabase.from("companies").insert(fields).select().single();
  if (error) throw friendly(error);
  return data;
}

export async function updateCompany(id, fields) {
  const { data, error } = await supabase.from("companies").update(fields).eq("id", id).select().single();
  if (error) throw friendly(error);
  return data;
}

/** A company with only a name, used by the "+ Create company" option in pickers. */
export async function createMinimalCompany(name) {
  const trimmed = name.trim();
  const { data: existing } = await supabase.from("companies").select("id, name").ilike("name", trimmed).limit(1).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from("companies").insert({ name: trimmed }).select("id, name").single();
  if (error) throw friendly(error);
  return data;
}

const friendly = (error) =>
  error.code === "23505" ? new Error("A company with this name already exists.") : error;

/** id of the company whose name matches (case-insensitive), or null. */
export async function findCompanyIdByName(name) {
  if (!name?.trim()) return null;
  const { data } = await supabase.from("companies").select("id").ilike("name", name.trim()).limit(1).maybeSingle();
  return data?.id ?? null;
}

// ---- Panel data -----------------------------------------------------------------------

export async function fetchCompanyContacts(companyId) {
  const { data, error } = await supabase.from("contacts").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllContacts() {
  const { data, error } = await supabase.from("contacts").select("id, name, title, company, company_id").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function linkContactToCompany(contactId, company) {
  const { error } = await supabase
    .from("contacts")
    .update({ company_id: company.id, company: company.name })
    .eq("id", contactId);
  if (error) throw error;
}

export async function fetchCompanyDeals(companyId) {
  const { data, error } = await supabase
    .from("deals")
    .select("id, title, rfq_number, status, invoice_amount, closing_date")
    .eq("company_id", companyId)
    .order("closing_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

// Revenue counts delivered deals and ones already invoiced (invoicing follows delivery);
// the open pipeline is everything not delivered/invoiced/declined/rejected and not still in triage.
const REVENUE = new Set(["delivered", "invoiced"]);
const NOT_OPEN = new Set([...REVENUE, "declined", "rejected", "triage_pending"]);
export function dealTotals(deals) {
  let revenue = 0;
  let pipeline = 0;
  for (const d of deals) {
    const amount = Number(d.invoice_amount) || 0;
    if (REVENUE.has(d.status)) revenue += amount;
    else if (!NOT_OPEN.has(d.status)) pipeline += amount;
  }
  return { revenue, pipeline };
}

export async function fetchInteractions(companyId) {
  const { data, error } = await supabase
    .from("contact_interactions")
    .select("*, contacts(name)")
    .eq("company_id", companyId)
    .order("interaction_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addInteraction({ company_id, contact_id, interaction_type, note, interaction_date }) {
  const { data, error } = await supabase
    .from("contact_interactions")
    .insert({ company_id, contact_id: contact_id || null, interaction_type, note, interaction_date })
    .select("*, contacts(name)")
    .single();
  if (error) throw error;
  return data;
}

/** Crosshairs touchpoint (Companies page, Crosshairs page): logs it and bumps last_touchpoint_date. */
export async function logCrosshairsTouchpoint(companyId, { date, note }) {
  const touchpointDate = date || manilaToday();
  const { error } = await supabase
    .from("crosshairs_touchpoints")
    .insert({ company_id: companyId, touchpoint_date: touchpointDate, note: note || null });
  if (error) throw error;
  return updateCompany(companyId, { last_touchpoint_date: touchpointDate });
}

/** Home's featured-company touchpoint: an "other" interaction plus the date bump. */
export async function logHomeTouchpoint(companyId, note) {
  const today = manilaToday();
  const { error } = await supabase
    .from("contact_interactions")
    .insert({ company_id: companyId, interaction_type: "other", note: note || "Touchpoint logged from Home", interaction_date: new Date().toISOString() });
  if (error) throw error;
  await updateCompany(companyId, { last_touchpoint_date: today });
  return today;
}

// ---- CSV import -----------------------------------------------------------------------

const HEADER_ALIASES = {
  name: ["name", "company name", "company", "company_name"],
  types: ["type", "types"],
  industry: ["industry", "sector"],
  website: ["website", "web", "url", "site"],
  address: ["address", "location"],
};

/** Returns { companies, skipped } — rows without a name are skipped (name is required). */
export function csvToCompanies(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one company.");
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    if (idx !== -1) col[field] = idx;
  }
  if (col.name === undefined) throw new Error('No name column found. Add a header such as "Name" or "Company Name".');

  const byLower = new Map(COMPANY_TYPES.map((t) => [t.toLowerCase(), t]));
  let skipped = 0;
  const seen = new Set();
  const companies = [];
  for (const row of rows.slice(1)) {
    const get = (f) => (col[f] === undefined ? "" : (row[col[f]] ?? "").trim()) || null;
    const name = get("name");
    if (!name) {
      skipped++;
      continue;
    }
    if (seen.has(name.toLowerCase())) continue; // duplicate row inside the file
    seen.add(name.toLowerCase());
    const types = [...new Set((get("types") ?? "").split(/[,;/]/).map((t) => byLower.get(t.trim().toLowerCase())).filter(Boolean))];
    companies.push({ name, types, industry: get("industry"), website: get("website"), address: get("address") });
  }
  if (!companies.length) throw new Error("No rows with a name were found in the CSV.");
  return { companies, skipped };
}

/** Inserts the rows whose names don't exist yet; returns how many were added. */
export async function bulkInsertCompanies(companies) {
  const { data: existing, error: readError } = await supabase.from("companies").select("name");
  if (readError) throw readError;
  const have = new Set((existing ?? []).map((c) => c.name.toLowerCase()));
  const fresh = companies.filter((c) => !have.has(c.name.toLowerCase()));
  if (fresh.length) {
    const { error } = await supabase.from("companies").insert(fresh);
    if (error) throw error;
  }
  return fresh.length;
}

export async function existingCompanyNames() {
  const { data } = await supabase.from("companies").select("name");
  return new Set((data ?? []).map((c) => c.name.toLowerCase()));
}

// ---- Dates ----------------------------------------------------------------------------

/** Whole days since a yyyy-mm-dd date (Manila today), or null. */
export function daysSince(date) {
  if (!date) return null;
  return Math.round((new Date(`${manilaToday()}T00:00:00Z`) - new Date(`${String(date).slice(0, 10)}T00:00:00Z`)) / 86400000);
}

export const daysAgoText = (date) => {
  const d = daysSince(date);
  if (d === null) return "Never";
  return d <= 0 ? "Today" : d === 1 ? "1 day ago" : `${d} days ago`;
};

export function formatInteractionDate(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`;
}
