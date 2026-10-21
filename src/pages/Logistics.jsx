import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FORWARDER_TYPES,
  FORWARDER_MODES,
  STATUSES,
  fetchForwarders,
  deleteForwarder,
  formatLastUsed,
  isRecentlyUsed,
  matchesValue,
} from "../lib/logistics";
import Toast, { useToast } from "../components/Toast";
import ForwarderModal from "./logistics/ForwarderModal";
import ForwarderPanel from "./logistics/ForwarderPanel";
import { UserIcon, PhoneIcon, MailIcon, StarIcon, BigTruckIcon } from "./logistics/LogisticsIcons";
import "./Logistics.css";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const FADE_MS = 250;

function ForwarderCard({ f, fading, confirming, onOpen, onEdit, onAskDelete, onCancelDelete, onConfirmDelete }) {
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  return (
    <article
      className={`lg-card${fading ? " fading" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.target === e.currentTarget && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
    >
      <div className="lg-card-top">
        <h3 className="lg-card-name">{f.company_name}</h3>
        <div className="lg-badges">
          <span className={`lg-badge ${f.status}`}>{cap(f.status)}</span>
          <span className={`lg-badge ${f.preferred_status}`}>{cap(f.preferred_status)}</span>
        </div>
      </div>
      {f.trading_name && <p className="lg-trading">{f.trading_name}</p>}
      {f.type?.length > 0 && (
        <div className="lg-pills">
          {f.type.map((t) => (
            <span key={t} className="lg-pill">{t}</span>
          ))}
        </div>
      )}

      <hr className="lg-divider" />

      <ul className="lg-contact">
        {f.primary_contact && (
          <li><UserIcon width={12} height={12} />{f.primary_contact}</li>
        )}
        {f.phone && (
          <li><PhoneIcon width={12} height={12} />{f.phone}</li>
        )}
        {f.email && (
          <li><MailIcon width={12} height={12} /><span className="lg-trunc">{f.email}</span></li>
        )}
      </ul>

      {f.modes?.length > 0 && (
        <div className="lg-row">
          <span className="lg-row-label">Modes</span>
          <span className="lg-pills">
            {f.modes.map((m) => (
              <span key={m} className="lg-pill gray">{m}</span>
            ))}
          </span>
        </div>
      )}
      {f.ports_covered && (
        <div className="lg-row">
          <span className="lg-row-label">Ports</span>
          <span className="lg-trunc lg-row-val">{f.ports_covered}</span>
        </div>
      )}

      <div className="lg-card-bottom">
        <span className="lg-stars-static" aria-label={f.rating ? `${f.rating} of 5 stars` : "Not rated"}>
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon key={n} width={12} height={12} filled={n <= (f.rating ?? 0)} className={n <= (f.rating ?? 0) ? "on" : ""} />
          ))}
        </span>
        <span className="lg-last-used">{formatLastUsed(f.last_used)}</span>
      </div>

      <div className="lg-card-foot">
        {confirming ? (
          <>
            <span className="lg-confirm-text">Are you sure?</span>
            <button type="button" className="lg-link danger" onClick={stop(onConfirmDelete)}>Confirm</button>
            <button type="button" className="lg-link" onClick={stop(onCancelDelete)}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className="lg-btn outline xs" onClick={stop(onEdit)}>Edit</button>
            <button type="button" className="lg-link danger" onClick={stop(onAskDelete)}>Delete</button>
          </>
        )}
      </div>
    </article>
  );
}

export default function Logistics() {
  const [forwarders, setForwarders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null); // null | { forwarder: row | null }
  const [detailId, setDetailId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [fadingId, setFadingId] = useState(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    fetchForwarders()
      .then(setForwarders)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(
    () => ({
      total: forwarders.length,
      active: forwarders.filter((f) => f.status === "active").length,
      preferred: forwarders.filter((f) => f.preferred_status === "preferred").length,
      recent: forwarders.filter((f) => isRecentlyUsed(f)).length,
    }),
    [forwarders]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forwarders.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (!matchesValue(f.type, typeFilter) || !matchesValue(f.modes, modeFilter)) return false;
      if (!q) return true;
      return f.company_name?.toLowerCase().includes(q) || f.primary_contact?.toLowerCase().includes(q);
    });
  }, [forwarders, search, typeFilter, modeFilter, statusFilter]);

  const detail = forwarders.find((f) => f.id === detailId) ?? null;

  const openDetail = (f) => {
    setDetailId(f.id);
    setPanelOpen(true);
  };
  const closePanel = useCallback(() => setPanelOpen(false), []);

  function openEdit(f) {
    setPanelOpen(false);
    setModal({ forwarder: f });
  }

  function handleSaved(saved, wasEdit) {
    // Keep list order consistent with the server's company_name sort.
    setForwarders((list) =>
      (wasEdit ? list.map((f) => (f.id === saved.id ? saved : f)) : [...list, saved]).sort((a, b) =>
        a.company_name.localeCompare(b.company_name)
      )
    );
    setModal(null);
    showToast("Forwarder saved");
  }

  async function handleDelete(f) {
    try {
      await deleteForwarder(f.id);
    } catch (e) {
      setConfirmId(null);
      showToast(e.message ?? "Could not delete forwarder", "error");
      return;
    }
    setConfirmId(null);
    setFadingId(f.id);
    setTimeout(() => {
      setForwarders((list) => list.filter((x) => x.id !== f.id));
      setFadingId(null);
      if (detailId === f.id) setPanelOpen(false);
    }, FADE_MS);
  }

  const addButton = (
    <button type="button" className="lg-btn primary" onClick={() => setModal({ forwarder: null })}>
      + Add Forwarder
    </button>
  );

  return (
    <div className="lg-page">
      <header className="lg-header">
        <div>
          <h1 className="lg-title">Logistics</h1>
          <p className="lg-subtitle">Freight forwarders and logistics partners</p>
        </div>
        {addButton}
      </header>

      <div className="lg-stats">
        <div className="lg-chip"><b>{stats.total}</b> Total forwarders</div>
        <div className="lg-chip"><i className="lg-dot green" /><b>{stats.active}</b> Active</div>
        <div className="lg-chip"><i className="lg-dot blue" /><b>{stats.preferred}</b> Preferred</div>
        <div className="lg-chip"><i className="lg-dot amber" /><b>{stats.recent}</b> Used recently</div>
      </div>

      <div className="lg-filters">
        <input
          className="lg-input lg-search"
          type="search"
          placeholder="Search by name or contact..."
          aria-label="Search forwarders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="lg-input lg-select" aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {FORWARDER_TYPES.map((t) => (
            <option key={t} value={t.toLowerCase()}>{t}</option>
          ))}
        </select>
        <select className="lg-input lg-select" aria-label="Filter by mode" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
          <option value="all">All modes</option>
          {FORWARDER_MODES.map((m) => (
            <option key={m} value={m.toLowerCase()}>{m}</option>
          ))}
        </select>
        <select className="lg-input lg-select" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{cap(s)}</option>
          ))}
        </select>
      </div>

      {loadError ? (
        <p className="lg-state error" role="alert">Could not load forwarders: {loadError}</p>
      ) : loading ? (
        <p className="lg-state">Loading…</p>
      ) : forwarders.length === 0 ? (
        <div className="lg-empty">
          <BigTruckIcon width={64} height={64} />
          <h2>No logistics partners yet</h2>
          <p>Add your freight forwarders and customs brokers to track them here</p>
          {addButton}
        </div>
      ) : filtered.length === 0 ? (
        <p className="lg-state">No forwarders match these filters.</p>
      ) : (
        <div className="lg-grid">
          {filtered.map((f) => (
            <ForwarderCard
              key={f.id}
              f={f}
              fading={fadingId === f.id}
              confirming={confirmId === f.id}
              onOpen={() => openDetail(f)}
              onEdit={() => openEdit(f)}
              onAskDelete={() => setConfirmId(f.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => handleDelete(f)}
            />
          ))}
        </div>
      )}

      <ForwarderPanel open={panelOpen} forwarder={detail} onClose={closePanel} onEdit={openEdit} />

      {modal && (
        <ForwarderModal
          forwarder={modal.forwarder}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
