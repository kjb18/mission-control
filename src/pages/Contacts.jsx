import { useEffect, useMemo, useState } from "react";
import { fetchContacts } from "../lib/contacts";
import ContactFormModal from "./contacts/ContactFormModal";

const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "company", label: "Company" },
  { key: "title", label: "Role" },
  { key: "tag", label: "Tag" },
  { key: "last_contact_date", label: "Last Contact" },
];

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("All");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [formContact, setFormContact] = useState(null);

  function load() {
    setLoading(true);
    fetchContacts()
      .then(setContacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = contacts.filter((c) => {
      if (tagFilter !== "All" && c.tag !== tagFilter) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [contacts, search, tagFilter, sortKey, sortDir]);

  function handleSaved() {
    setFormContact(null);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">Contacts</p>
          <h1 className="text-2xl font-semibold text-white">Directory</h1>
        </div>
        <button
          onClick={() => setFormContact({})}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-base-950 text-sm font-semibold shrink-0"
        >
          + New Contact
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, email…"
          className="input flex-1 min-w-[200px]"
        />
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="input w-40">
          <option value="All">All Tags</option>
          <option value="Client">Client</option>
          <option value="Supplier">Supplier</option>
        </select>
      </div>

      <div className="rounded-lg border border-line bg-base-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-secondary border-b border-line">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="py-3 px-4 cursor-pointer select-none hover:text-ink-secondary"
                >
                  {col.label} {sortKey === col.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-line">
                <td className="py-3 px-4 text-white">{c.name}</td>
                <td className="py-3 px-4 text-ink-secondary">{c.company || "—"}</td>
                <td className="py-3 px-4 text-ink-secondary">{c.title || "—"}</td>
                <td className="py-3 px-4">
                  <span
                    className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
                      c.tag === "Supplier" ? "text-blue-400 bg-blue-500/15" : "text-blue-400 bg-blue-500/15"
                    }`}
                  >
                    {c.tag}
                  </span>
                </td>
                <td className="py-3 px-4 text-ink-secondary">{c.last_contact_date || "—"}</td>
                <td className="py-3 px-4">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-xs px-3 py-1.5 rounded-lg bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white">
                      Send Email
                    </a>
                  ) : (
                    <span className="text-xs text-ink-muted">No email</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <button onClick={() => setFormContact(c)} className="text-xs text-ink-secondary hover:text-white">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-ink-muted">
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formContact !== null && (
        <ContactFormModal
          contact={formContact.id ? formContact : null}
          onClose={() => setFormContact(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
