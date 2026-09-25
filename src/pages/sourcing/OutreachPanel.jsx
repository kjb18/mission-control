import { useState } from "react";
import { draftOutreachEmail, buildMailto } from "../../lib/outreach";

export default function OutreachPanel({ line, suppliers }) {
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [draft, setDraft] = useState(null); // { subject, body }
  const [error, setError] = useState(null);

  function pickSupplier(name) {
    setSupplierName(name);
    const match = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
    setSupplierEmail(match?.email ?? "");
  }

  async function handleDraft() {
    if (!supplierName.trim()) return;
    setDrafting(true);
    setError(null);
    setBlocked(null);
    setDraft(null);
    try {
      const result = await draftOutreachEmail({
        supplierName,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
      });
      if (result.blocked) {
        setBlocked(result.reason);
      } else {
        setDraft({ subject: result.subject, body: result.body });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="block flex-1 min-w-[180px]">
          <span className="block text-[11px] text-ink-secondary mb-1">Supplier to contact</span>
          <input
            list="outreach-supplier-names"
            value={supplierName}
            onChange={(e) => pickSupplier(e.target.value)}
            className="input"
            placeholder="Supplier name"
          />
          <datalist id="outreach-supplier-names">
            {suppliers.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="block text-[11px] text-ink-secondary mb-1">Supplier email</span>
          <input
            type="email"
            value={supplierEmail}
            onChange={(e) => setSupplierEmail(e.target.value)}
            className="input"
            placeholder="optional"
          />
        </label>
        <button
          onClick={handleDraft}
          disabled={drafting || !supplierName.trim()}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 text-sm font-medium"
        >
          {drafting ? "Drafting…" : "Draft Outreach Email"}
        </button>
      </div>

      {blocked && (
        <p className="text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          🚫 Blocked: {blocked}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {draft && (
        <div className="rounded-lg border border-line bg-base-800 p-3 space-y-2">
          <label className="block">
            <span className="block text-[11px] text-ink-secondary mb-1">Subject</span>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] text-ink-secondary mb-1">Body (edit before sending)</span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={6}
              className="input resize-none"
            />
          </label>
          <a
            href={buildMailto({ to: supplierEmail, subject: draft.subject, body: draft.body })}
            className="inline-block px-4 py-2 rounded-lg bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm"
          >
            Open in Email (mailto)
          </a>
          <p className="text-[11px] text-white/25">
            Sent via mailto for now — Gmail OAuth isn't connected yet, so this opens your default
            mail app with the draft prefilled instead of sending directly.
          </p>
        </div>
      )}
    </div>
  );
}
