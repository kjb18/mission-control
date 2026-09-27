import { useEffect, useMemo, useState } from "react";
import { fetchContacts } from "../lib/contacts";
import ContactFormModal from "./contacts/ContactFormModal";
import { PageHeader, Card, Badge, Button, DataTable, EmptyState } from "../components/ui";

const SORTABLE_COLUMNS = [
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

  const columns = [
    ...SORTABLE_COLUMNS.map(({ key, label }) => ({
      key,
      label: (
        <span className="cursor-pointer select-none hover:text-ink-secondary" onClick={() => toggleSort(key)}>
          {label} {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </span>
      ),
      render:
        key === "tag"
          ? (c) => <Badge variant={c.tag === "Supplier" ? "purple" : "blue"}>{c.tag}</Badge>
          : key === "name"
          ? (c) => c.name
          : (c) => c[key] || "—",
    })),
    {
      key: "contact",
      label: "Contact",
      render: (c) =>
        c.email ? (
          <a
            href={`mailto:${c.email}`}
            className="inline-flex items-center justify-center rounded-lg text-[13px] font-medium transition-all duration-150 hover:opacity-90 active:scale-[0.98] bg-base-900 border border-line text-ink-secondary"
            style={{ padding: "8px 16px" }}
          >
            Send Email
          </a>
        ) : (
          <span className="text-xs text-ink-muted">No email</span>
        ),
    },
    {
      key: "edit",
      label: "",
      render: (c) => (
        <button onClick={() => setFormContact(c)} className="text-xs text-ink-secondary hover:text-white">
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Directory"
        action={
          <Button variant="primary" onClick={() => setFormContact({})}>
            + New Contact
          </Button>
        }
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
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

      {!loading && filtered.length === 0 ? (
        <Card>
          <EmptyState title="No contacts found" subtitle="Try a different search or add a new contact." />
        </Card>
      ) : (
        <Card noPadding className="overflow-x-auto">
          <DataTable columns={columns} rows={filtered} />
        </Card>
      )}

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
