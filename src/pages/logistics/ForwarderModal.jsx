import { useEffect, useState } from "react";
import {
  FORWARDER_TYPES,
  FORWARDER_MODES,
  SERVICE_AREAS,
  PAYMENT_TERMS,
  INCOTERMS,
  CURRENCIES,
  STATUSES,
  PREFERRED_STATUSES,
  toForm,
  toRow,
  createForwarder,
  updateForwarder,
} from "../../lib/logistics";
import { CloseIcon, StarIcon } from "./LogisticsIcons";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Section({ title, children }) {
  return (
    <section className="lg-sec">
      <h3 className="lg-sec-label">{title}</h3>
      <div className="lg-sec-body">{children}</div>
    </section>
  );
}

function Field({ label, required, wide, children }) {
  return (
    <label className={`lg-field${wide ? " wide" : ""}`}>
      <span className="lg-field-label">
        {label}
        {required && <span className="lg-req"> *</span>}
      </span>
      {children}
    </label>
  );
}

function CheckGroup({ label, options, value, onChange }) {
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <div className="lg-field wide" role="group" aria-label={label}>
      <span className="lg-field-label">{label}</span>
      <div className="lg-checks">
        {options.map((opt) => (
          <label key={opt} className={`lg-check${value.includes(opt) ? " on" : ""}`}>
            <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function RadioGroup({ label, name, options, value, onChange }) {
  return (
    <div className="lg-field wide" role="radiogroup" aria-label={label}>
      <span className="lg-field-label">{label}</span>
      <div className="lg-checks">
        {options.map((opt) => (
          <label key={opt} className={`lg-check${value === opt ? " on" : ""}`}>
            <input type="radio" name={name} checked={value === opt} onChange={() => onChange(opt)} />
            {cap(opt)}
          </label>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="lg-field toggle">
      <span className="lg-field-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`lg-switch${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export default function ForwarderModal({ forwarder, onClose, onSaved, onError }) {
  const isEdit = Boolean(forwarder?.id);
  const [form, setForm] = useState(() => toForm(forwarder));
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const onText = (key) => (e) => set(key)(e.target.value);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const nameMissing = !form.company_name.trim();

  async function save() {
    setTouched(true);
    if (nameMissing) return;
    setSaving(true);
    try {
      const row = toRow(form);
      const saved = isEdit ? await updateForwarder(forwarder.id, row) : await createForwarder(row);
      onSaved(saved, isEdit);
    } catch (e) {
      onError(e.message ?? "Could not save forwarder");
      setSaving(false);
    }
  }

  return (
    <div className="lg-overlay" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="lg-modal" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit forwarder" : "Add logistics partner"}>
        <header className="lg-modal-head">
          {isEdit ? (
            <input
              className="lg-modal-title-input"
              value={form.company_name}
              onChange={onText("company_name")}
              placeholder="Company name"
              aria-label="Company name"
            />
          ) : (
            <h2 className="lg-modal-title">Add Logistics Partner</h2>
          )}
          <button type="button" className="lg-x" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="lg-modal-body">
          <Section title="Company details">
            {!isEdit && (
              <Field label="Company name" required wide>
                <input
                  className={`lg-input${touched && nameMissing ? " invalid" : ""}`}
                  value={form.company_name}
                  onChange={onText("company_name")}
                  autoFocus
                />
              </Field>
            )}
            {isEdit && touched && nameMissing && <p className="lg-err wide">Company name is required.</p>}
            <Field label="Trading name" wide>
              <input className="lg-input" value={form.trading_name} onChange={onText("trading_name")} />
            </Field>
            <CheckGroup label="Type" options={FORWARDER_TYPES} value={form.type} onChange={set("type")} />
            {form.type.length > 0 && (
              <div className="lg-pills wide">
                {form.type.map((t) => (
                  <span key={t} className="lg-pill">{t}</span>
                ))}
              </div>
            )}
            <RadioGroup label="Status" name="status" options={STATUSES} value={form.status} onChange={set("status")} />
            <RadioGroup
              label="Preferred status"
              name="preferred_status"
              options={PREFERRED_STATUSES}
              value={form.preferred_status}
              onChange={set("preferred_status")}
            />
          </Section>

          <Section title="Contact">
            <Field label="Primary contact">
              <input className="lg-input" value={form.primary_contact} onChange={onText("primary_contact")} />
            </Field>
            <Field label="Phone">
              <input className="lg-input" type="tel" value={form.phone} onChange={onText("phone")} />
            </Field>
            <Field label="Email">
              <input className="lg-input" type="email" value={form.email} onChange={onText("email")} />
            </Field>
            <Field label="Account manager">
              <input className="lg-input" value={form.account_manager} onChange={onText("account_manager")} />
            </Field>
            <Field label="Account number">
              <input className="lg-input" value={form.account_number} onChange={onText("account_number")} />
            </Field>
          </Section>

          <Section title="Services">
            <CheckGroup label="Modes handled" options={FORWARDER_MODES} value={form.modes} onChange={set("modes")} />
            <Field label="Ports or airports covered" wide>
              <input
                className="lg-input"
                value={form.ports_covered}
                onChange={onText("ports_covered")}
                placeholder="e.g. NAIA, Port of Manila, Cebu Port"
              />
            </Field>
            <CheckGroup label="Service areas" options={SERVICE_AREAS} value={form.service_areas} onChange={set("service_areas")} />
            <Toggle label="Warehousing" checked={form.warehousing} onChange={set("warehousing")} />
            <Toggle label="Customs brokerage included" checked={form.customs_brokerage} onChange={set("customs_brokerage")} />
          </Section>

          <Section title="Commercial">
            <Field label="Payment terms">
              <select className="lg-input" value={form.payment_terms} onChange={onText("payment_terms")}>
                <option value="">Select…</option>
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select className="lg-input" value={form.currency} onChange={onText("currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <CheckGroup label="Incoterms handled" options={INCOTERMS} value={form.incoterms} onChange={set("incoterms")} />
          </Section>

          <Section title="Compliance and history">
            <Field label="Accreditation number">
              <input className="lg-input" value={form.accreditation_number} onChange={onText("accreditation_number")} />
            </Field>
            <Field label="Insurance details">
              <input className="lg-input" value={form.insurance_details} onChange={onText("insurance_details")} />
            </Field>
            <Field label="First used">
              <input className="lg-input" type="date" value={form.first_used} onChange={onText("first_used")} />
            </Field>
            <Field label="Last used">
              <input className="lg-input" type="date" value={form.last_used} onChange={onText("last_used")} />
            </Field>
            <div className="lg-field wide">
              <span className="lg-field-label">Rating</span>
              <div className="lg-stars" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className={`lg-star-btn${n <= (form.rating ?? 0) ? " on" : ""}`}
                    // Clicking the current rating again clears it (the column is nullable).
                    onClick={() => set("rating")(form.rating === n ? null : n)}
                  >
                    <StarIcon filled={n <= (form.rating ?? 0)} />
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Notes">
            <label className="lg-field wide">
              <span className="sr-only">Notes</span>
              <textarea className="lg-input lg-notes" value={form.notes} onChange={onText("notes")} />
            </label>
          </Section>
        </div>

        <footer className="lg-modal-foot">
          <button type="button" className="lg-btn outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="lg-btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}
