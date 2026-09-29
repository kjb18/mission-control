import { supabase } from "./supabaseClient";

/**
 * RFC 4180-style CSV parser: quoted fields, commas and newlines inside
 * quotes, "" as an escaped quote, CRLF or LF line endings, optional BOM.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error("The CSV has an unclosed quote.");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// CSV header aliases → contacts table columns. The table stores the
// person's name in `name` and their role in `title`.
const HEADER_ALIASES = {
  name: ["name", "full name", "full_name", "contact name"],
  company: ["company", "company name", "organization", "org"],
  title: ["role", "title", "job title", "position"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile", "telephone", "tel"],
  tag: ["tag", "type", "category"],
  notes: ["notes", "note", "comments"],
};

/**
 * Returns { contacts, skipped } — rows without a name are skipped because
 * contacts.name is NOT NULL.
 */
export function csvToContacts(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one contact.");

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const columnIndex = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    if (idx !== -1) columnIndex[field] = idx;
  }
  if (columnIndex.name === undefined) {
    throw new Error('No name column found. Add a header such as "Name" or "Full Name".');
  }

  let skipped = 0;
  const contacts = [];
  for (const row of rows.slice(1)) {
    const get = (field) => {
      const idx = columnIndex[field];
      const value = idx === undefined ? "" : (row[idx] ?? "").trim();
      return value || null;
    };
    const name = get("name");
    if (!name) {
      skipped++;
      continue;
    }
    const tag = get("tag")?.toLowerCase();
    contacts.push({
      name,
      company: get("company"),
      title: get("title"),
      email: get("email"),
      phone: get("phone"),
      tag: tag === "supplier" ? "Supplier" : "Client",
      notes: get("notes"),
    });
  }
  if (!contacts.length) throw new Error("No rows with a name were found in the CSV.");
  return { contacts, skipped };
}

/** One POST to PostgREST with the whole array. */
export async function bulkInsertContacts(contacts) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/contacts`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token ?? anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(contacts),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Supabase insert failed (${res.status}).`);
  }
}
