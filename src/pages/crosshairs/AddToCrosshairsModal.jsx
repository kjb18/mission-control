import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import CompanyPicker from "../../components/CompanyPicker";
import { PRIORITIES, addToCrosshairs } from "../../lib/crosshairs";
import { fetchCompanyOptions, createMinimalCompany } from "../../lib/companies";
import { Button } from "../../components/ui";

/** Searchable list of all companies; picking one sets crosshairs_active and asks for a priority. */
export default function AddToCrosshairsModal({ onClose, onSaved }) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(null);
  const [priority, setPriority] = useState("Medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCompanyOptions().then(setCompanies).catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!companyId) {
      setError("Choose a company first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addToCrosshairs(companyId, priority);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title="Add to Crosshairs" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="block">
          <span className="block text-xs text-ink-secondary mb-1">Company</span>
          <CompanyPicker
            companies={companies}
            value={companyId}
            onChange={setCompanyId}
            allowClear={false}
            autoFocus
            onCreate={async (name) => {
              const created = await createMinimalCompany(name);
              setCompanies((list) => (list.some((c) => c.id === created.id) ? list : [...list, created]));
              return created;
            }}
          />
        </div>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="primary" className="!bg-violet-600" disabled={saving}>
            {saving ? "Adding…" : "Add to Crosshairs"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
