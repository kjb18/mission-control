import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DECLINE_REASONS,
  UNDO_WINDOW_MS,
  VERDICTS,
  effectiveVerdict,
  fetchTriageItems,
  acceptItem,
  declineItem,
  setOverride,
  undoItem,
  createManualRfq,
  notifyTriageChanged,
  isManilaToday,
  formatClock,
  timeAgo,
  daysUntil,
  itemName,
  splitReason,
} from "../lib/triage";
import Toast, { useToast } from "../components/Toast";
import "./Triage.css";

const FADE_MS = 250;
const MAX_ITEM_PILLS = 3;
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const fmtDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function ClosingInfo({ date }) {
  const days = daysUntil(date);
  if (days === null) return null;
  const tone = days < 0 ? "red" : days < 7 ? "amber" : "";
  const text = days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "closes today" : `${days} day${days === 1 ? "" : "s"} left`;
  return (
    <span className={`tr-closing ${tone}`}>
      Closes {fmtDate(date)} · {text}
    </span>
  );
}

function TriageCard({ item, fading, busy, onAccept, onDecline, onOverride }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const verdict = effectiveVerdict(item);
  const meta = verdict ? VERDICTS[verdict] : null;
  const items = (item.items_detected ?? []).map(itemName).filter(Boolean);
  const heading = [item.from_name, item.client_name].filter(Boolean).join(" · ") || item.from_email || "Unknown sender";

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <article className={`tr-card${fading ? " fading" : ""}`}>
      <div className="tr-card-top">
        <h3 className="tr-card-name">{heading}</h3>
        <span className="tr-ago">{timeAgo(item.received_at)}</span>
      </div>
      {item.from_email && <p className="tr-from">{item.from_email}</p>}
      {item.subject && <p className="tr-subject">{item.subject}</p>}

      {(item.rfq_number || item.closing_date) && (
        <div className="tr-meta">
          {item.rfq_number && <span className="tr-rfq">{item.rfq_number}</span>}
          <ClosingInfo date={item.closing_date} />
        </div>
      )}

      {items.length > 0 && (
        <div className="tr-items">
          {items.slice(0, MAX_ITEM_PILLS).map((name, i) => (
            <span key={i} className="tr-item-pill" title={name}>{truncate(name, 30)}</span>
          ))}
          {items.length > MAX_ITEM_PILLS && <span className="tr-item-pill more">+{items.length - MAX_ITEM_PILLS} more</span>}
        </div>
      )}

      {meta && (
        <div className="tr-rec" style={{ background: meta.bg, borderLeftColor: meta.border }}>
          <div className="tr-rec-head">
            <span className="tr-verdict" style={{ color: meta.fg }}>{meta.label}</span>
            {item.triage_override && <span className="tr-overridden">overridden</span>}
            {item.claude_confidence != null && <span className="tr-conf">{item.claude_confidence}% confidence</span>}
          </div>
          {item.claude_reason && <p className="tr-reason">{item.claude_reason}</p>}
        </div>
      )}

      <div className="tr-actions">
        <button type="button" className="tr-btn accept" disabled={busy} onClick={onAccept}>Accept</button>
        <div className="tr-decline-wrap" ref={menuRef}>
          <button type="button" className="tr-btn decline" disabled={busy} onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
            Decline
          </button>
          {menuOpen && (
            <div className="tr-menu" role="menu">
              <p className="tr-menu-title">Reason for declining</p>
              {DECLINE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitem"
                  className="tr-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onDecline(r);
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        {item.claude_verdict && (
          <button type="button" className="tr-btn override" disabled={busy} onClick={onOverride}>
            Override
          </button>
        )}
      </div>
    </article>
  );
}

function ManualModal({ onClose, onSaved, onError }) {
  const [form, setForm] = useState({ client_name: "", rfq_number: "", subject: "", items: "", closing_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function save() {
    setTouched(true);
    if (!form.client_name.trim()) return;
    setSaving(true);
    try {
      const row = await createManualRfq({
        ...form,
        client_name: form.client_name.trim(),
        rfq_number: form.rfq_number.trim(),
        subject: form.subject.trim(),
        notes: form.notes.trim(),
      });
      onSaved(row);
    } catch (e) {
      onError(e.message ?? "Could not add RFQ");
      setSaving(false);
    }
  }

  return (
    <div className="tr-overlay" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="tr-modal" role="dialog" aria-modal="true" aria-label="Add manual RFQ">
        <h2 className="tr-modal-title">Add Manual RFQ</h2>
        <label className="tr-field">
          <span>Client name <b className="tr-req">*</b></span>
          <input className={`tr-input${touched && !form.client_name.trim() ? " invalid" : ""}`} value={form.client_name} onChange={set("client_name")} autoFocus />
        </label>
        <div className="tr-field-row">
          <label className="tr-field">
            <span>RFQ number</span>
            <input className="tr-input" value={form.rfq_number} onChange={set("rfq_number")} />
          </label>
          <label className="tr-field">
            <span>Closing date</span>
            <input className="tr-input" type="date" value={form.closing_date} onChange={set("closing_date")} />
          </label>
        </div>
        <label className="tr-field">
          <span>Subject</span>
          <input className="tr-input" value={form.subject} onChange={set("subject")} />
        </label>
        <label className="tr-field">
          <span>Items <i>(one per line, or comma separated)</i></span>
          <textarea className="tr-input tr-area" value={form.items} onChange={set("items")} />
        </label>
        <label className="tr-field">
          <span>Notes</span>
          <textarea className="tr-input tr-area" value={form.notes} onChange={set("notes")} />
        </label>
        <div className="tr-modal-foot">
          <button type="button" className="tr-btn outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="tr-btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Triage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [fadingId, setFadingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    return fetchTriageItems()
      .then(setItems)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Ticks so "x minutes ago" and the 10-minute Undo window stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const log = useMemo(
    () =>
      items
        .filter((i) => (i.status === "accepted" || i.status === "declined") && isManilaToday(i.processed_at))
        .sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at)),
    [items]
  );
  const stats = useMemo(
    () => ({
      awaiting: pending.length,
      accepted: log.filter((i) => i.status === "accepted").length,
      declined: log.filter((i) => i.status === "declined").length,
      auto: items.filter((i) => i.triage_source === "gmail_agent" || i.gmail_thread_id).length,
    }),
    [pending, log, items]
  );

  // Runs a decision, then fades the card out before the list reloads.
  async function decide(item, action, successMessage) {
    setBusyId(item.id);
    try {
      await action();
    } catch (e) {
      setBusyId(null);
      showToast(e.message ?? "Something went wrong", "error");
      return;
    }
    setFadingId(item.id);
    await new Promise((r) => setTimeout(r, FADE_MS));
    setFadingId(null);
    setBusyId(null);
    showToast(successMessage);
    notifyTriageChanged();
    await load();
  }

  async function handleOverride(item) {
    const next = !item.triage_override;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, triage_override: next } : i)));
    try {
      await setOverride(item, next);
    } catch (e) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, triage_override: !next } : i)));
      showToast(e.message ?? "Could not save override", "error");
    }
  }

  async function handleUndo(item) {
    setBusyId(item.id);
    try {
      await undoItem(item);
      showToast("Decision undone — back in the queue");
      notifyTriageChanged();
      await load();
    } catch (e) {
      showToast(e.message ?? "Could not undo", "error");
    }
    setBusyId(null);
  }

  const addButton = (
    <button type="button" className="tr-btn primary" onClick={() => setModalOpen(true)}>
      + Add Manual RFQ
    </button>
  );

  return (
    <div className="tr-page">
      <header className="tr-header">
        <div>
          <h1 className="tr-title">RFQ Triage</h1>
          <p className="tr-subtitle">Review and route incoming RFQs</p>
        </div>
        {addButton}
      </header>

      <div className="tr-stats">
        <div className="tr-chip"><b>{stats.awaiting}</b> Awaiting decision</div>
        <div className="tr-chip"><i className="tr-dot green" /><b>{stats.accepted}</b> Accepted today</div>
        <div className="tr-chip"><i className="tr-dot red" /><b>{stats.declined}</b> Declined today</div>
        <div className="tr-chip"><i className="tr-dot blue" /><b>{stats.auto}</b> Auto-detected</div>
      </div>

      {loadError && <p className="tr-state error" role="alert">Could not load triage queue: {loadError}</p>}

      <div className="tr-cols">
        <section className="tr-col-queue" aria-label="Triage queue">
          <h2 className="tr-sec-label">
            Awaiting decision <span className="tr-count">{pending.length}</span>
          </h2>
          {loading ? (
            <p className="tr-state">Loading…</p>
          ) : pending.length === 0 ? (
            <div className="tr-empty">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12.5 2.8 2.8L16 9.8" />
              </svg>
              <h3>All clear</h3>
              <p>No RFQs awaiting your decision</p>
            </div>
          ) : (
            pending.map((item) => (
              <TriageCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                fading={fadingId === item.id}
                onAccept={() => decide(item, () => acceptItem(item), "RFQ accepted and added to Pipeline")}
                onDecline={(reason) => decide(item, () => declineItem(item, reason), "RFQ declined")}
                onOverride={() => handleOverride(item)}
              />
            ))
          )}
        </section>

        <aside className="tr-col-log" aria-label="Disposition log">
          <h2 className="tr-sec-label">Today's decisions</h2>
          {log.length === 0 ? (
            <p className="tr-log-empty">No decisions yet today.</p>
          ) : (
            <ul className="tr-log">
              {log.map((i) => {
                const canUndo = now - new Date(i.processed_at).getTime() < UNDO_WINDOW_MS;
                const declined = splitReason(i.claude_reason).declined;
                return (
                  <li key={i.id} className="tr-log-row">
                    <span className={`tr-log-badge ${i.status}`}>{i.status === "accepted" ? "ACCEPTED" : "DECLINED"}</span>
                    <div className="tr-log-main">
                      <p className="tr-log-name">{[i.client_name, i.rfq_number].filter(Boolean).join(" · ") || i.subject || "RFQ"}</p>
                      <p className="tr-log-sub">
                        {formatClock(i.processed_at)}
                        {declined ? ` · ${declined}` : ""}
                      </p>
                    </div>
                    {canUndo && (
                      <button type="button" className="tr-undo" disabled={busyId === i.id} onClick={() => handleUndo(i)}>
                        Undo
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="tr-manual">
            <h2 className="tr-sec-label">Manual entry</h2>
            <p className="tr-manual-hint">Got an RFQ outside Gmail? Add it here and decide on it with the rest.</p>
            {addButton}
          </div>
        </aside>
      </div>

      {modalOpen && (
        <ManualModal
          onClose={() => setModalOpen(false)}
          onSaved={(row) => {
            setItems((list) => [row, ...list]);
            setModalOpen(false);
            showToast("RFQ added to the triage queue");
            notifyTriageChanged();
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
