import { useState } from "react";
import Modal from "../../components/Modal";
import { Badge, Button } from "../../components/ui";
import { createProjectForRfq } from "../../lib/pipeline";

function Row({ label, children }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-ink-secondary">{label}</span>
      <span className="text-white min-w-0 break-words">{children || "—"}</span>
    </div>
  );
}

/** Shown for a Pipeline card with no linked project: RFQ details + Create Project. */
export default function RfqDetailsModal({ card, onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      onCreated(await createProjectForRfq(card));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`RFQ — ${card.rfqNumber || card.title}`} onClose={onClose}>
      <div className="space-y-2.5">
        <Row label="RFQ number">{card.rfqNumber}</Row>
        <Row label="Title">{card.title}</Row>
        <Row label="Client">{card.clientName}</Row>
        <Row label="Status">
          <Badge variant="gray">{String(card.status).replace(/_/g, " ")}</Badge>
        </Row>
        <Row label="Closing date">{card.closingDate}</Row>
        <Row label="Notes">{card.notes}</Row>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="primary" onClick={handleCreate} disabled={busy}>
          {busy ? "Creating…" : "Create Project"}
        </Button>
      </div>
    </Modal>
  );
}
