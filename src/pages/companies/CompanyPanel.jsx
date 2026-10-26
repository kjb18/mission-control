import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COMPANY_TYPES,
  COMPANY_STATUSES,
  ACCOUNT_TIERS,
  PRIORITIES,
  INTERACTION_TYPES,
  updateCompany,
  fetchCompanyContacts,
  fetchAllContacts,
  linkContactToCompany,
  fetchCompanyDeals,
  dealTotals,
  fetchInteractions,
  addInteraction,
  logCrosshairsTouchpoint,
  formatInteractionDate,
} from "../../lib/companies";
import { dealStatusMeta } from "../../lib/deals";
import ContactFormModal from "../contacts/ContactFormModal";
import { CloseIcon, PhoneIcon, MailIcon } from "../logistics/LogisticsIcons";
import { TypePill, StatusBadge, cap, phpFmt } from "./shared";
import "../../components/TaskPanel.css";

const TABS = ["Overview", "Contacts", "Deals", "Crosshairs", "Interactions"];

// ---- Inline field: saves on blur, flashes a green check -------------------------------
function InlineField({ label, value, onSave, type = "text", multiline = false, options = null, wide = false }) {
  const [val, setVal] = useState(value ?? "");
  const [state, setState] = useState("idle"); // idle | saved | error
  const [message, setMessage] = useState("");
  const timer = useRef(null);

  useEffect(() => setVal(value ?? ""), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function commit(next) {
    if (String(next) === String(value ?? "")) return;
    try {
      await onSave(next);
      setState("saved");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 1400);
    } catch (e) {
      setVal(value ?? "");
      setMessage(e.message ?? "Could not save");
      setState("error");
    }
  }

  const common = {
    className: "co-input",
    value: val,
    onChange: (e) => {
      setVal(e.target.value);
      if (state === "error") setState("idle");
    },
  };
  return (
    <div className={`co-ifield${wide ? " wide" : ""}`}>
      <div className="co-ifield-top">
        <span className="co-field-label">{label}</span>
        {state === "saved" && <span className="co-check-flash" role="status" aria-label="Saved">✓</span>}
      </div>
      {options ? (
        <select {...common} onChange={(e) => { setVal(e.target.value); commit(e.target.value); }}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : multiline ? (
        <textarea {...common} className="co-input co-area" onBlur={() => commit(val)} />
      ) : (
        <input {...common} type={type} onBlur={() => commit(val)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      )}
      {state === "error" && <p className="co-err">{message}</p>}
    </div>
  );
}

const opts = (list, { none = null, label = (x) => x } = {}) => [
  ...(none !== null ? [{ value: "", label: none }] : []),
  ...list.map((x) => ({ value: x, label: label(x) })),
];

// ---- Overview ------------------------------------------------------------------------
function OverviewTab({ company, save }) {
  const [typesFlash, setTypesFlash] = useState(false);
  const toggleType = async (t) => {
    const next = company.types?.includes(t) ? company.types.filter((x) => x !== t) : [...(company.types ?? []), t];
    await save("types", next);
    setTypesFlash(true);
    setTimeout(() => setTypesFlash(false), 1400);
  };
  const F = (field, label, extra = {}) => (
    <InlineField key={field} label={label} value={company[field]} onSave={(v) => save(field, v)} {...extra} />
  );
  return (
    <div className="co-tab">
      <section>
        <h3 className="tp-sec-label">Company details</h3>
        <div className="co-igrid">
          {F("name", "Name", { wide: true })}
          {F("trading_name", "Trading name")}
          {F("industry", "Industry")}
          <div className="co-ifield wide" role="group" aria-label="Types">
            <div className="co-ifield-top">
              <span className="co-field-label">Types</span>
              {typesFlash && <span className="co-check-flash" role="status" aria-label="Saved">✓</span>}
            </div>
            <div className="co-checks">
              {COMPANY_TYPES.map((t) => (
                <label key={t} className={`co-check${company.types?.includes(t) ? " on" : ""}`}>
                  <input type="checkbox" checked={Boolean(company.types?.includes(t))} onChange={() => toggleType(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>
          {F("website", "Website")}
          {F("tin", "TIN")}
          {F("address", "Address", { wide: true })}
          {F("status", "Status", { options: opts(COMPANY_STATUSES, { label: cap }) })}
        </div>
      </section>
      <section>
        <h3 className="tp-sec-label">Account</h3>
        <div className="co-igrid">
          {F("account_tier", "Tier", { options: opts(ACCOUNT_TIERS, { none: "None" }) })}
          {F("first_engagement_date", "First engagement", { type: "date" })}
          {F("relationship_owner", "Relationship owner", { wide: true })}
          <div className="co-ifield wide">
            <label className="co-check">
              <input
                type="checkbox"
                checked={Boolean(company.crosshairs_active)}
                onChange={(e) => save("crosshairs_active", e.target.checked)}
              />
              On Crosshairs
            </label>
          </div>
        </div>
      </section>
      <section>
        <h3 className="tp-sec-label">Intelligence</h3>
        <div className="co-igrid">
          {F("known_products", "Known products", { multiline: true, wide: true })}
          {F("known_clients", "Known clients", { multiline: true, wide: true })}
          {F("known_pricing", "Known pricing", { multiline: true, wide: true })}
          {F("strengths", "Strengths", { multiline: true, wide: true })}
          {F("weaknesses", "Weaknesses", { multiline: true, wide: true })}
        </div>
      </section>
      <section>
        <h3 className="tp-sec-label">Notes</h3>
        <InlineField label="Notes" value={company.notes} onSave={(v) => save("notes", v)} multiline wide />
      </section>
    </div>
  );
}

// ---- Contacts ------------------------------------------------------------------------
function ContactsTab({ company, onCountChange, showToast, onModalChange }) {
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const [all, setAll] = useState([]);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    fetchCompanyContacts(company.id)
      .then((rows) => {
        setContacts(rows);
        onCountChange(rows.length);
      })
      .catch((e) => setError(e.message));
  }, [company.id, onCountChange]);

  useEffect(load, [load]);
  useEffect(() => onModalChange(adding), [adding, onModalChange]);

  async function openLink() {
    setLinking(true);
    try {
      setAll(await fetchAllContacts());
    } catch (e) {
      setError(e.message);
    }
  }
  async function link(contact) {
    try {
      await linkContactToCompany(contact.id, company);
      setLinking(false);
      setQuery("");
      showToast(`${contact.name} linked to ${company.name}`);
      load();
    } catch (e) {
      showToast(e.message ?? "Could not link contact", "error");
    }
  }

  const candidates = all
    .filter((c) => c.company_id !== company.id && c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 30);

  return (
    <div className="co-tab">
      <div className="co-tab-actions">
        <button type="button" className="co-btn primary sm" onClick={() => setAdding(true)}>+ Add Contact</button>
        <button type="button" className="co-btn outline sm" onClick={() => (linking ? setLinking(false) : openLink())}>Link Existing</button>
      </div>
      {linking && (
        <div className="co-linkbox">
          <input className="co-input" autoFocus placeholder="Search all contacts…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="co-linklist">
            {candidates.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => link(c)}>
                  <b>{c.name}</b>
                  <span>{[c.title, c.company].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
            {!candidates.length && <li className="co-muted">No matching contacts</li>}
          </ul>
        </div>
      )}
      {error && <p className="co-err">{error}</p>}
      {contacts === null ? (
        <p className="co-muted">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="co-muted">No contacts linked to this company yet.</p>
      ) : (
        <ul className="co-list">
          {contacts.map((c) => (
            <li key={c.id} className="co-row">
              <div className="co-row-main">
                <p className="co-row-title">{c.name}</p>
                <p className="co-row-sub">{c.title || "—"}</p>
                <p className="co-row-sub">
                  {c.email && <span><MailIcon width={11} height={11} /> {c.email}</span>}
                  {c.phone && <span><PhoneIcon width={11} height={11} /> {c.phone}</span>}
                </p>
              </div>
              {c.contact_type && <span className="co-badge ct">{c.contact_type}</span>}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <ContactFormModal
          contact={null}
          defaultCompany={{ id: company.id, name: company.name }}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---- Deals ---------------------------------------------------------------------------
function DealsTab({ company }) {
  const navigate = useNavigate();
  const [deals, setDeals] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetchCompanyDeals(company.id).then(setDeals).catch((e) => setError(e.message));
  }, [company.id]);
  const totals = useMemo(() => dealTotals(deals ?? []), [deals]);

  return (
    <div className="co-tab">
      <div className="co-tab-actions">
        <button
          type="button"
          className="co-btn primary sm"
          onClick={() => navigate(`/triage?new=1&company_id=${company.id}&company=${encodeURIComponent(company.name)}`)}
        >
          + New Deal
        </button>
      </div>
      {error && <p className="co-err">{error}</p>}
      {deals === null ? (
        <p className="co-muted">Loading…</p>
      ) : deals.length === 0 ? (
        <p className="co-muted">No deals linked to this company yet.</p>
      ) : (
        <>
          <ul className="co-list">
            {deals.map((d) => {
              const meta = d.status === "triage_pending" ? { label: "In triage", fg: "#92400e", bg: "#fef3c7" } : dealStatusMeta(d.status);
              return (
                <li key={d.id} className="co-row clickable" onClick={() => navigate(`/deals/${d.id}`)}>
                  <div className="co-row-main">
                    <p className="co-row-title">{d.title || d.rfq_number || "Untitled deal"}</p>
                    <p className="co-row-sub">{d.closing_date ? `Closes ${d.closing_date}` : "No closing date"}</p>
                  </div>
                  <div className="co-row-right">
                    <span className="co-badge" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span>
                    <b>{phpFmt.format(Number(d.invoice_amount) || 0)}</b>
                  </div>
                </li>
              );
            })}
          </ul>
          <dl className="co-totals">
            <div><dt>Revenue (delivered)</dt><dd>{phpFmt.format(totals.revenue)}</dd></div>
            <div><dt>Open pipeline</dt><dd>{phpFmt.format(totals.pipeline)}</dd></div>
          </dl>
        </>
      )}
    </div>
  );
}

// ---- Crosshairs ----------------------------------------------------------------------
function CrosshairsTab({ company, save, onTouchpoint }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const updated = await logCrosshairsTouchpoint(company.id, { note: note.trim() });
      onTouchpoint(updated);
      setNote("");
      setLogged(true);
      setTimeout(() => setLogged(false), 3000);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="co-tab">
      <div className="co-igrid">
        <InlineField label="Priority" value={company.priority ?? ""} onSave={(v) => save("priority", v)} options={opts(PRIORITIES, { none: "None" })} />
        <InlineField label="Last touchpoint" type="date" value={company.last_touchpoint_date} onSave={(v) => save("last_touchpoint_date", v)} />
        <InlineField label="Next suggested action" value={company.next_suggested_action} onSave={(v) => save("next_suggested_action", v)} wide />
        <InlineField label="Estimated deal value (PHP)" type="number" value={company.estimated_deal_value} onSave={(v) => save("estimated_deal_value", v)} />
        <InlineField label="Current stage" value={company.current_stage} onSave={(v) => save("current_stage", v)} />
      </div>
      <section className="co-touch">
        <h3 className="tp-sec-label">Log touchpoint</h3>
        <textarea className="co-input co-area" placeholder="Note what happened..." value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="co-touch-foot">
          <button type="button" className="co-btn primary sm" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          {logged && <span className="co-ok" role="status">Touchpoint logged</span>}
        </div>
        {error && <p className="co-err">{error}</p>}
      </section>
    </div>
  );
}

// ---- Interactions --------------------------------------------------------------------
const TYPE_ICON = {
  call: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  email: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  visit: (<><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>),
  whatsapp: <path d="M4 5h16v11H9l-5 4z" />,
  meeting: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  other: <circle cx="12" cy="12" r="3" />,
};

function InteractionIcon({ type }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TYPE_ICON[type] ?? TYPE_ICON.other}
    </svg>
  );
}

const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function InteractionsTab({ company }) {
  const [items, setItems] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ interaction_type: "call", contact_id: "", note: "", when: nowLocalInput() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInteractions(company.id).then(setItems).catch((e) => setError(e.message));
    fetchCompanyContacts(company.id).then(setContacts).catch(() => {});
  }, [company.id]);

  async function submit() {
    if (!form.note.trim()) {
      setError("Add a note first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const row = await addInteraction({
        company_id: company.id,
        contact_id: form.contact_id,
        interaction_type: form.interaction_type,
        note: form.note.trim(),
        interaction_date: new Date(form.when).toISOString(),
      });
      setItems((list) => [row, ...(list ?? [])].sort((a, b) => new Date(b.interaction_date) - new Date(a.interaction_date)));
      setForm((f) => ({ ...f, note: "", when: nowLocalInput() }));
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="co-tab">
      <section className="co-iform">
        <div className="co-igrid">
          <label className="co-ifield">
            <span className="co-field-label">Type</span>
            <select className="co-input" value={form.interaction_type} onChange={(e) => setForm({ ...form, interaction_type: e.target.value })}>
              {INTERACTION_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
            </select>
          </label>
          <label className="co-ifield">
            <span className="co-field-label">Contact</span>
            <select className="co-input" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
              <option value="">None</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="co-ifield wide">
            <span className="co-field-label">Date and time</span>
            <input className="co-input" type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
          </label>
          <label className="co-ifield wide">
            <span className="co-field-label">Note</span>
            <textarea className="co-input co-area" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="What happened?" />
          </label>
        </div>
        <button type="button" className="co-btn primary sm" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Add Interaction"}</button>
        {error && <p className="co-err">{error}</p>}
      </section>

      {items === null ? (
        <p className="co-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="co-muted">No interactions logged yet.</p>
      ) : (
        <ul className="co-feed">
          {items.map((i) => (
            <li key={i.id} className="co-feed-item">
              <span className={`co-feed-icon it-${i.interaction_type}`}><InteractionIcon type={i.interaction_type} /></span>
              <div>
                <p className="co-feed-note">{i.note}</p>
                <p className="co-row-sub">
                  {cap(i.interaction_type ?? "other")}
                  {i.contacts?.name ? ` · ${i.contacts.name}` : ""} · {formatInteractionDate(i.interaction_date)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Panel ---------------------------------------------------------------------------
export default function CompanyPanel({ open, company: initial, onClose, onChange, onEdit, showToast }) {
  const panelRef = useRef(null);
  const [company, setCompany] = useState(initial);
  const [tab, setTab] = useState("Overview");
  const [childModalOpen, setChildModalOpen] = useState(false);

  useEffect(() => {
    setCompany(initial);
    setTab("Overview");
  }, [initial?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (childModalOpen || panelRef.current?.contains(e.target) || e.target.closest?.(".co-card, .co-overlay")) return;
      onClose();
    };
    const onKey = (e) => e.key === "Escape" && !childModalOpen && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, childModalOpen]);

  const apply = useCallback(
    (updated) => {
      setCompany((c) => ({ ...c, ...updated }));
      onChange(updated);
    },
    [onChange]
  );

  const save = useCallback(
    async (field, value) => {
      if (field === "name" && !String(value).trim()) throw new Error("Name is required.");
      let v = typeof value === "string" ? value.trim() || null : value;
      if (field === "estimated_deal_value") v = v === null || v === "" ? null : Number(v);
      const patch = { [field]: v };
      // Putting a company on Crosshairs needs a priority for the rotation.
      if (field === "crosshairs_active" && v && !company.priority) patch.priority = "Medium";
      if (field === "status" && !v) patch.status = "active";
      apply(await updateCompany(company.id, patch));
    },
    [company, apply]
  );

  const setContactCount = useCallback((n) => onChange({ id: company?.id, contact_count: n }), [onChange, company?.id]);
  const tabs = TABS.filter((t) => t !== "Crosshairs" || company?.crosshairs_active);

  return (
    <>
      <div className={`tp-overlay${open ? " open" : ""}`}></div>
      <div ref={panelRef} className={`tp-panel co-panel${open ? " open" : ""}`} role="dialog" aria-label="Company details" aria-hidden={!open}>
        {company && (
          <>
            <div className="tp-head co-panel-head">
              <div className="co-panel-title">
                <h2>{company.name}</h2>
                <div className="co-panel-sub">
                  <StatusBadge status={company.status ?? "active"} />
                  {(company.types ?? []).map((t) => <TypePill key={t} type={t} />)}
                </div>
              </div>
              <button type="button" className="co-btn outline sm" onClick={() => onEdit(company)}>Edit</button>
              <button type="button" className="tp-close" onClick={onClose} aria-label="Close"><CloseIcon width={16} height={16} /></button>
            </div>
            <div className="co-tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={`co-tab-btn${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="tp-body co-panel-body" key={company.id}>
              {tab === "Overview" && <OverviewTab company={company} save={save} />}
              {tab === "Contacts" && <ContactsTab company={company} onCountChange={setContactCount} showToast={showToast} onModalChange={setChildModalOpen} />}
              {tab === "Deals" && <DealsTab company={company} />}
              {tab === "Crosshairs" && company.crosshairs_active && <CrosshairsTab company={company} save={save} onTouchpoint={apply} />}
              {tab === "Interactions" && <InteractionsTab company={company} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}

