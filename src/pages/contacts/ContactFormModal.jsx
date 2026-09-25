import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import { CONTACT_TAGS, createContact, updateContact, deleteContact, fetchClientsForLinking } from "../../lib/contacts";

const empty = {
  name: "",
  company: "",
  title: "",
  email: "",
  phone: "",
  tag: "Client",
  last_contact_date: "",
  notes: "",
  client_id: "",
};

export default function ContactFormModal({ contact, onClose, onSaved }) {
  const isEdit = Boolean(contact);
  const [form, setForm] = useState(
    contact
      ? {
          name: contact.name ?? "",
          company: contact.company ?? "",
          title: contact.title ?? "",
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          tag: contact.tag ?? "Client",
          last_contact_date: contact.last_contact_date ?? "",
          notes: contact.notes ?? "",
          client_id: contact.client_id ?? "",
        }
      : empty
  );
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchClientsForLinking().then(setClients).catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, client_id: form.client_id || null, last_contact_date: form.last_contact_date || null };
      if (isEdit) await updateContact(contact.id, payload);
      else await createContact(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${contact.name}?`)) return;
    setSaving(true);
    try {
      await deleteContact(contact.id);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Contact" : "New Contact"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Full Name</span>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Company</span>
            <input value={form.company} onChange={(e) => update("company", e.target.value)} className="input" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Role</span>
            <input value={form.title} onChange={(e) => update("title", e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Tag</span>
            <select value={form.tag} onChange={(e) => update("tag", e.target.value)} className="input">
              {CONTACT_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Email</span>
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Phone</span>
            <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="input" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Last Contact Date</span>
            <input
              type="date"
              value={form.last_contact_date}
              onChange={(e) => update("last_contact_date", e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">Link to Client (optional)</span>
            <select value={form.client_id} onChange={(e) => update("client_id", e.target.value)} className="input">
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Notes</span>
          <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} className="input resize-none" />
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Contact"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm"
          >
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="ml-auto px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
