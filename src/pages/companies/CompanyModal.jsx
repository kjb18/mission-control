import { useEffect, useState } from "react";
import {
  COMPANY_TYPES,
  COMPANY_STATUSES,
  ACCOUNT_TIERS,
  PRIORITIES,
  toForm,
  toRow,
  createCompany,
  updateCompany,
} from "../../lib/companies";
import { CloseIcon } from "../logistics/LogisticsIcons";
import { cap } from "./shared";

function Field({ label, required, wide, children }) {
  return (
    <label className={`co-field${wide ? " wide" : ""}`}>
      <span className="co-field-label">
        {label}
        {required && <b className="co-req"> *</b>}
      </span>
      {children}
    </label>
  );
}

export default function CompanyModal({ company, onClose, onSaved, onError }) {
  const isEdit = Boolean(company?.id);
  const [form, setForm] = useState(() => toForm(company));
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k) => (e) => set(k)(e.target.value);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const toggleType = (t) => set("types")(form.types.includes(t) ? form.types.filter((x) => x !== t) : [...form.types, t]);
  const nameMissing = !form.name.trim();

  async function save() {
    setTouched(true);
    if (nameMissing) return;
    setSaving(true);
    try {
      const row = toRow(form);
      // Putting a company on Crosshairs needs a priority for the rotation.
      if (row.crosshairs_active && !row.priority) row.priority = "Medium";
      const saved = isEdit ? await updateCompany(company.id, row) : await createCompany(row);
      onSaved(saved, isEdit);
    } catch (e) {
      onError(e.message ?? "Could not save company");
      setSaving(false);
    }
  }

  return (
    <div className="co-overlay" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="co-modal" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit company" : "Add company"}>
        <header className="co-modal-head">
          <h2>{isEdit ? "Edit Company" : "Add Company"}</h2>
          <button type="button" className="co-x" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </header>

        <div className="co-modal-body">
          <section>
            <h3 className="co-sec-label">Company details</h3>
            <div className="co-grid">
              <Field label="Name" required wide>
                <input className={`co-input${touched && nameMissing ? " invalid" : ""}`} value={form.name} onChange={text("name")} autoFocus />
              </Field>
              <Field label="Trading name"><input className="co-input" value={form.trading_name} onChange={text("trading_name")} /></Field>
              <Field label="Industry"><input className="co-input" value={form.industry} onChange={text("industry")} /></Field>
              <div className="co-field wide" role="group" aria-label="Types">
                <span className="co-field-label">Types</span>
                <div className="co-checks">
                  {COMPANY_TYPES.map((t) => (
                    <label key={t} className={`co-check${form.types.includes(t) ? " on" : ""}`}>
                      <input type="checkbox" checked={form.types.includes(t)} onChange={() => toggleType(t)} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Website"><input className="co-input" value={form.website} onChange={text("website")} placeholder="https://" /></Field>
              <Field label="TIN"><input className="co-input" value={form.tin} onChange={text("tin")} /></Field>
              <Field label="Address" wide><input className="co-input" value={form.address} onChange={text("address")} /></Field>
              <Field label="Status">
                <select className="co-input" value={form.status} onChange={text("status")}>
                  {COMPANY_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section>
            <h3 className="co-sec-label">Account</h3>
            <div className="co-grid">
              <Field label="Account tier">
                <select className="co-input" value={form.account_tier} onChange={text("account_tier")}>
                  <option value="">None</option>
                  {ACCOUNT_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="First engagement"><input className="co-input" type="date" value={form.first_engagement_date} onChange={text("first_engagement_date")} /></Field>
              <Field label="Relationship owner" wide><input className="co-input" value={form.relationship_owner} onChange={text("relationship_owner")} /></Field>
            </div>
          </section>

          <section>
            <h3 className="co-sec-label">Intelligence</h3>
            <div className="co-grid">
              <Field label="Known products" wide><textarea className="co-input co-area" value={form.known_products} onChange={text("known_products")} /></Field>
              <Field label="Known clients" wide><textarea className="co-input co-area" value={form.known_clients} onChange={text("known_clients")} /></Field>
              <Field label="Known pricing" wide><textarea className="co-input co-area" value={form.known_pricing} onChange={text("known_pricing")} /></Field>
              <Field label="Strengths"><textarea className="co-input co-area" value={form.strengths} onChange={text("strengths")} /></Field>
              <Field label="Weaknesses"><textarea className="co-input co-area" value={form.weaknesses} onChange={text("weaknesses")} /></Field>
            </div>
          </section>

          <section>
            <h3 className="co-sec-label">Crosshairs</h3>
            <div className="co-grid">
              <label className="co-check wide-check">
                <input type="checkbox" checked={form.crosshairs_active} onChange={(e) => set("crosshairs_active")(e.target.checked)} />
                Active on Crosshairs
              </label>
              {form.crosshairs_active && (
                <>
                  <Field label="Priority">
                    <select className="co-input" value={form.priority} onChange={text("priority")}>
                      <option value="">Medium (default)</option>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Estimated deal value (PHP)"><input className="co-input" type="number" step="0.01" value={form.estimated_deal_value} onChange={text("estimated_deal_value")} /></Field>
                  <Field label="Current stage"><input className="co-input" value={form.current_stage} onChange={text("current_stage")} /></Field>
                  <Field label="Last touchpoint"><input className="co-input" type="date" value={form.last_touchpoint_date} onChange={text("last_touchpoint_date")} /></Field>
                  <Field label="Next suggested action" wide><input className="co-input" value={form.next_suggested_action} onChange={text("next_suggested_action")} /></Field>
                </>
              )}
            </div>
          </section>

          <section>
            <h3 className="co-sec-label">Notes</h3>
            <textarea className="co-input co-area tall" value={form.notes} onChange={text("notes")} aria-label="Notes" />
          </section>
        </div>

        <footer className="co-modal-foot">
          <button type="button" className="co-btn outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="co-btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </footer>
      </div>
    </div>
  );
}
