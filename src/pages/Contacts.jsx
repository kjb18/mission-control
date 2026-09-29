import { useEffect, useMemo, useRef, useState } from "react";
import { fetchContacts } from "../lib/contacts";
import { csvToContacts, bulkInsertContacts } from "../lib/contactsCsv";
import ContactFormModal from "./contacts/ContactFormModal";
import Modal from "../components/Modal";
import FileDropOverlay, { useFileDrop } from "../components/FileDropOverlay";
import Toast, { useToast } from "../components/Toast";
import { PageHeader, Card, Badge, Button, DataTable, EmptyState } from "../components/ui";

const isCsv = (file) => /\.csv$/i.test(file.name) || file.type === "text/csv";

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
  const [importPreview, setImportPreview] = useState(null); // { contacts, skipped, fileName }
  const [importing, setImporting] = useState(false);
  const [toast, showToast] = useToast();
  const csvInputRef = useRef(null);

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

  async function readCsv(file) {
    if (!isCsv(file)) {
      showToast("That isn't a CSV file. Choose a .csv export of your contacts.", "error");
      return;
    }
    try {
      const { contacts, skipped } = csvToContacts(await file.text());
      setImportPreview({ contacts, skipped, fileName: file.name });
    } catch (e) {
      showToast(`Couldn't parse ${file.name}: ${e.message}`, "error");
    }
  }

  const dragging = useFileDrop((files) => {
    if (!importing) readCsv(files[0]);
  });

  async function confirmImport() {
    setImporting(true);
    try {
      await bulkInsertContacts(importPreview.contacts);
      const n = importPreview.contacts.length;
      setImportPreview(null);
      showToast(`${n} contact${n === 1 ? "" : "s"} imported successfully`);
      load();
    } catch (e) {
      showToast(`Import failed: ${e.message}`, "error");
    } finally {
      setImporting(false);
    }
  }

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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => csvInputRef.current?.click()}>
              Import CSV
            </Button>
            <Button variant="primary" onClick={() => setFormContact({})}>
              + New Contact
            </Button>
          </div>
        }
      />
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readCsv(file);
          e.target.value = "";
        }}
      />
      <FileDropOverlay show={dragging} text="Drop your contacts CSV here" />
      <Toast toast={toast} />

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

      {importPreview && (
        <Modal
          title={`Import contacts from ${importPreview.fileName}`}
          onClose={() => !importing && setImportPreview(null)}
          maxWidth="max-w-3xl"
        >
          <p className="text-sm text-ink-secondary mb-3">
            {importPreview.contacts.length} contact{importPreview.contacts.length === 1 ? "" : "s"} found
            {importPreview.skipped > 0 && ` · ${importPreview.skipped} row${importPreview.skipped === 1 ? "" : "s"} without a name will be skipped`}
            {importPreview.contacts.length > 5 && " · showing the first 5"}
          </p>
          <div className="overflow-x-auto border border-line rounded-[10px] mb-4">
            <table className="w-full text-xs">
              <thead className="bg-base-800 text-ink-secondary">
                <tr>
                  {["Name", "Company", "Role", "Email", "Phone", "Tag", "Notes"].map((h) => (
                    <th key={h} className="text-left font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importPreview.contacts.slice(0, 5).map((c, i) => (
                  <tr key={i} className="border-t border-line text-white">
                    {[c.name, c.company, c.title, c.email, c.phone, c.tag, c.notes].map((v, j) => (
                      <td key={j} className="px-3 py-2 max-w-[180px] truncate">{v || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportPreview(null)} disabled={importing}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${importPreview.contacts.length} contacts`}
            </Button>
          </div>
        </Modal>
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
