import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  COMPANY_TYPES,
  COMPANY_STATUSES,
  ACCOUNT_TIERS,
  fetchCompanies,
  csvToCompanies,
  bulkInsertCompanies,
  existingCompanyNames,
  daysSince,
} from "../lib/companies";
import Toast, { useToast } from "../components/Toast";
import FileDropOverlay, { useFileDrop } from "../components/FileDropOverlay";
import CompanyModal from "./companies/CompanyModal";
import CompanyPanel from "./companies/CompanyPanel";
import { TypePill, StatusBadge, PriorityBadge, TierBadge, Flame, cap } from "./companies/shared";
import "./Companies.css";

const isCsv = (file) => /\.csv$/i.test(file.name) || file.type === "text/csv";

function CompanyCard({ c, onOpen, onEdit }) {
  const since = daysSince(c.last_touchpoint_date);
  return (
    <article
      className="co-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.target === e.currentTarget && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
    >
      <div className="co-card-top">
        <h3 className="co-card-name">{c.name}</h3>
        <div className="co-card-badges">
          <StatusBadge status={c.status ?? "active"} />
          {c.crosshairs_active && <Flame />}
        </div>
      </div>
      {c.types?.length > 0 && (
        <div className="co-pills">
          {c.types.map((t) => <TypePill key={t} type={t} />)}
        </div>
      )}
      {c.industry && <p className="co-industry">{c.industry}</p>}
      <div className="co-card-meta">
        <Link to={`/people?company=${c.id}`} className="co-chip-link" onClick={(e) => e.stopPropagation()}>
          {c.contact_count} contact{c.contact_count === 1 ? "" : "s"}
        </Link>
        <TierBadge tier={c.account_tier} />
      </div>
      {c.crosshairs_active && (
        <div className="co-card-xh">
          <PriorityBadge priority={c.priority} />
          <span className="co-touch">
            {since === null ? "No touchpoint yet" : since <= 0 ? "Touched today" : `${since} day${since === 1 ? "" : "s"} ago`}
          </span>
        </div>
      )}
      <div className="co-card-foot">
        <button type="button" className="co-btn outline xs" onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</button>
        <button type="button" className="co-btn outline xs" onClick={(e) => { e.stopPropagation(); onOpen(); }}>View</button>
      </div>
    </article>
  );
}

function ImportModal({ preview, importing, onCancel, onConfirm }) {
  const { companies, skipped, duplicates, fileName } = preview;
  const fresh = companies.length - duplicates;
  return (
    <div className="co-overlay" onMouseDown={(e) => e.target === e.currentTarget && !importing && onCancel()}>
      <div className="co-modal wide" role="dialog" aria-modal="true" aria-label="Import companies">
        <header className="co-modal-head"><h2>Import companies from {fileName}</h2></header>
        <div className="co-modal-body">
          <p className="co-muted">
            {companies.length} compan{companies.length === 1 ? "y" : "ies"} found
            {duplicates > 0 && ` · ${duplicates} already exist and will be skipped`}
            {skipped > 0 && ` · ${skipped} row${skipped === 1 ? "" : "s"} without a name skipped`}
            {companies.length > 5 && " · showing the first 5"}
          </p>
          <div className="co-table-wrap">
            <table className="co-table">
              <thead><tr>{["Name", "Types", "Industry", "Website", "Address"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {companies.slice(0, 5).map((c, i) => (
                  <tr key={i}>
                    <td>{c.name}</td>
                    <td>{c.types.join(", ") || "—"}</td>
                    <td>{c.industry || "—"}</td>
                    <td>{c.website || "—"}</td>
                    <td>{c.address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="co-modal-foot">
          <button type="button" className="co-btn outline" onClick={onCancel} disabled={importing}>Cancel</button>
          <button type="button" className="co-btn primary" onClick={onConfirm} disabled={importing || fresh === 0}>
            {importing ? "Importing…" : `Import ${fresh} compan${fresh === 1 ? "y" : "ies"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function Companies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [crosshairsFilter, setCrosshairsFilter] = useState("all");
  const [modal, setModal] = useState(null); // null | { company: row | null }
  const [detailId, setDetailId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [toast, showToast] = useToast();
  const csvInputRef = useRef(null);

  const load = useCallback(
    () =>
      fetchCompanies()
        .then(setCompanies)
        .catch((e) => setLoadError(e.message))
        .finally(() => setLoading(false)),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  // /companies?open=<id> (from a People card) opens that company's slide-over.
  const openParam = searchParams.get("open");
  useEffect(() => {
    if (!openParam || loading) return;
    if (companies.some((c) => c.id === openParam)) {
      setDetailId(openParam);
      setPanelOpen(true);
    }
    setSearchParams({}, { replace: true });
  }, [openParam, loading, companies, setSearchParams]);

  const stats = useMemo(() => {
    const has = (t) => companies.filter((c) => c.types?.includes(t)).length;
    return {
      total: companies.length,
      clients: has("Client"),
      prospects: has("Prospect"),
      principals: has("Principal"),
      suppliers: has("Supplier"),
      crosshairs: companies.filter((c) => c.crosshairs_active).length,
    };
  }, [companies]);

  const industries = useMemo(() => [...new Set(companies.map((c) => c.industry).filter(Boolean))].sort(), [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (typeFilter !== "all" && !c.types?.includes(typeFilter)) return false;
      if (industryFilter !== "all" && c.industry !== industryFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (tierFilter !== "all" && c.account_tier !== tierFilter) return false;
      if (crosshairsFilter === "active" && !c.crosshairs_active) return false;
      return !q || c.name.toLowerCase().includes(q) || c.trading_name?.toLowerCase().includes(q);
    });
  }, [companies, search, typeFilter, industryFilter, statusFilter, tierFilter, crosshairsFilter]);

  const detail = companies.find((c) => c.id === detailId) ?? null;
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openDetail = (c) => {
    setDetailId(c.id);
    setPanelOpen(true);
  };
  // The panel reports saved fields (and contact counts) as partial rows.
  const mergeCompany = useCallback(
    (patch) => setCompanies((list) => list.map((c) => (c.id === patch.id ? { ...c, ...patch } : c))),
    []
  );

  function handleSaved(saved, wasEdit) {
    setCompanies((list) =>
      (wasEdit ? list.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)) : [...list, { ...saved, contact_count: 0 }]).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setModal(null);
    showToast("Company saved");
  }

  async function readCsv(file) {
    if (!isCsv(file)) {
      showToast("That isn't a CSV file. Choose a .csv export of your companies.", "error");
      return;
    }
    try {
      const { companies: rows, skipped } = csvToCompanies(await file.text());
      const have = await existingCompanyNames();
      setImportPreview({
        companies: rows,
        skipped,
        duplicates: rows.filter((r) => have.has(r.name.toLowerCase())).length,
        fileName: file.name,
      });
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
      const added = await bulkInsertCompanies(importPreview.companies);
      setImportPreview(null);
      showToast(`${added} compan${added === 1 ? "y" : "ies"} imported successfully`);
      load();
    } catch (e) {
      showToast(`Import failed: ${e.message}`, "error");
    } finally {
      setImporting(false);
    }
  }

  const addButton = (
    <button type="button" className="co-btn primary" onClick={() => setModal({ company: null })}>+ Add Company</button>
  );

  return (
    <div className="co-page">
      <header className="co-header">
        <div>
          <h1 className="co-title">Companies</h1>
          <p className="co-subtitle">Your full company directory</p>
        </div>
        <div className="co-header-actions">
          <button type="button" className="co-btn outline" onClick={() => csvInputRef.current?.click()}>Import CSV</button>
          {addButton}
        </div>
      </header>
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="co-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readCsv(file);
          e.target.value = "";
        }}
      />
      <FileDropOverlay show={dragging} text="Drop your companies CSV here" />

      <div className="co-stats">
        <div className="co-stat"><b>{stats.total}</b> Total</div>
        <div className="co-stat"><i className="co-dot client" /><b>{stats.clients}</b> Clients</div>
        <div className="co-stat"><i className="co-dot prospect" /><b>{stats.prospects}</b> Prospects</div>
        <div className="co-stat"><i className="co-dot principal" /><b>{stats.principals}</b> Principals</div>
        <div className="co-stat"><i className="co-dot supplier" /><b>{stats.suppliers}</b> Suppliers</div>
        <div className="co-stat"><Flame size={13} /><b>{stats.crosshairs}</b> Crosshairs Active</div>
      </div>

      <div className="co-filters">
        <input className="co-input co-search" type="search" placeholder="Search companies..." aria-label="Search companies" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="co-input" aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="co-input" aria-label="Filter by industry" value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}>
          <option value="all">All industries</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select className="co-input" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {COMPANY_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        <select className="co-input" aria-label="Filter by tier" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          <option value="all">All tiers</option>
          {ACCOUNT_TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}
        </select>
        <select className="co-input" aria-label="Filter by Crosshairs" value={crosshairsFilter} onChange={(e) => setCrosshairsFilter(e.target.value)}>
          <option value="all">All Crosshairs</option>
          <option value="active">Active only</option>
        </select>
      </div>

      {loadError ? (
        <p className="co-state error" role="alert">Could not load companies: {loadError}</p>
      ) : loading ? (
        <p className="co-state">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="co-empty">
          <h2>No companies yet</h2>
          <p>Add a company or import a CSV to start your directory</p>
          {addButton}
        </div>
      ) : filtered.length === 0 ? (
        <p className="co-state">No companies match these filters.</p>
      ) : (
        <div className="co-grid-cards">
          {filtered.map((c) => (
            <CompanyCard key={c.id} c={c} onOpen={() => openDetail(c)} onEdit={() => { setPanelOpen(false); setModal({ company: c }); }} />
          ))}
        </div>
      )}

      <CompanyPanel
        open={panelOpen}
        company={detail}
        onClose={closePanel}
        onChange={mergeCompany}
        onEdit={(c) => { setPanelOpen(false); setModal({ company: c }); }}
        showToast={showToast}
      />

      {modal && (
        <CompanyModal company={modal.company} onClose={() => setModal(null)} onSaved={handleSaved} onError={(m) => showToast(m, "error")} />
      )}
      {importPreview && (
        <ImportModal preview={importPreview} importing={importing} onCancel={() => setImportPreview(null)} onConfirm={confirmImport} />
      )}
      <Toast toast={toast} />
    </div>
  );
}
