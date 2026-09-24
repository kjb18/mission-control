import { useEffect, useState } from "react";
import Modal from "./Modal";
import { fetchPurchaseOrderForRfq, fetchRfqLinesForDelivery, confirmDelivery } from "../../lib/delivery";

export default function ConfirmDeliveryModal({ card, onClose, onSaved }) {
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchPurchaseOrderForRfq(card.id), fetchRfqLinesForDelivery(card.id)])
      .then(([po, lines]) => {
        setPurchaseOrder(po);
        setItems(
          lines.map((l) => ({
            description: l.description,
            unit: l.unit,
            quantityOrdered: l.quantity,
            quantityDelivered: l.quantity,
          }))
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [card.id]);

  function updateQuantity(index, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantityDelivered: value } : it)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!purchaseOrder) {
      setError("No purchase order found for this RFQ — receive the PO first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { emailResult } = await confirmDelivery({
        rfq: { id: card.id, client_id: card.clientId },
        purchaseOrder,
        deliveryDate,
        deliveryNoteNumber,
        itemsDelivered: items,
        photoFile,
      });
      onSaved(emailResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Confirm Delivery — ${card.rfqNumber || card.title}`} onClose={onClose}>
      {loading ? (
        <p className="text-sm text-white/40">Loading…</p>
      ) : !purchaseOrder ? (
        <p className="text-sm text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          No purchase order found for this RFQ. Receive the PO from the Quoted column first.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Delivery Date</span>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Delivery Note Number</span>
            <input
              value={deliveryNoteNumber}
              onChange={(e) => setDeliveryNoteNumber(e.target.value)}
              className="input"
            />
          </label>

          <div>
            <span className="block text-xs text-white/40 mb-1">Items Delivered</span>
            <ul className="space-y-1.5">
              {items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 bg-base-800 border border-white/10 rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-white/80 flex-1 truncate">{it.description}</span>
                  <input
                    type="number"
                    value={it.quantityDelivered}
                    onChange={(e) => updateQuantity(i, Number(e.target.value))}
                    className="w-20 rounded-lg bg-base-900 border border-white/10 px-2 py-1 text-sm text-white"
                  />
                  <span className="text-xs text-white/40 w-10">{it.unit}</span>
                </li>
              ))}
              {items.length === 0 && <li className="text-xs text-white/30">No line items found.</li>}
            </ul>
          </div>

          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Delivery Note Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-white/60"
            />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light disabled:opacity-50 text-base-950 text-sm font-semibold"
            >
              {saving ? "Confirming…" : "Confirm Delivery & Invoice"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
