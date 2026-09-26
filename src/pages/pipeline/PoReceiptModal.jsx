import { useState } from "react";
import Modal from "../../components/Modal";
import { createPoReceipt } from "../../lib/purchaseOrders";

export default function PoReceiptModal({ card, onClose, onSaved }) {
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [poAmount, setPoAmount] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!poNumber.trim() || !poAmount) {
      setError("PO number and amount are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPoReceipt({
        rfqId: card.id,
        clientId: card.clientId,
        poNumber: poNumber.trim(),
        poDate,
        poAmount: Number(poAmount),
        file,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Receive PO — ${card.rfqNumber || card.title}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">PO Number</span>
          <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">PO Date</span>
          <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">PO Amount (PHP)</span>
          <input
            type="number"
            step="0.01"
            value={poAmount}
            onChange={(e) => setPoAmount(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">PO Document (PDF or image)</span>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-secondary"
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-[10px] bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 text-sm font-semibold"
          >
            {saving ? "Saving…" : "Save PO & Mark Awarded"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-[10px] bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
