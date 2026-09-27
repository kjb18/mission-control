import { useCallback, useEffect, useState } from "react";
import { STAGES, fetchPipelineRfqs, updateRfqStage, urgencyFor, subscribeToRfqChanges } from "../lib/pipeline";
import PoReceiptModal from "./pipeline/PoReceiptModal";
import ConfirmDeliveryModal from "./pipeline/ConfirmDeliveryModal";
import { PageHeader, Card, Badge, Button } from "../components/ui";

const URGENCY_STYLES = {
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  green: "border-l-blue-500",
  none: "border-l-blue-500",
};

export default function Pipeline() {
  const [cards, setCards] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [poReceiptCard, setPoReceiptCard] = useState(null);
  const [deliveryCard, setDeliveryCard] = useState(null);

  const load = useCallback(() => {
    fetchPipelineRfqs().then(setCards).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    // Cards move automatically when rfqs.status changes anywhere — Intake
    // confirmation, Sourcing Desk, Quote Builder send, or a drag here.
    const unsubscribe = subscribeToRfqChanges(load);
    return unsubscribe;
  }, [load]);

  function handleDrop(e, stageKey) {
    e.preventDefault();
    setDragOverStage(null);
    const rfqId = e.dataTransfer.getData("text/plain");
    if (!rfqId) return;
    setCards((prev) => prev.map((c) => (c.id === rfqId ? { ...c, status: stageKey } : c)));
    updateRfqStage(rfqId, stageKey).catch((err) => {
      setError(err.message);
      load();
    });
  }

  function handlePoSaved() {
    setPoReceiptCard(null);
    setNotice("PO received — RFQ moved to Awarded.");
    load();
  }

  function handleDeliverySaved(emailResult) {
    setDeliveryCard(null);
    setNotice(
      emailResult?.ok
        ? "Delivery confirmed, invoice created, and emailed to the client."
        : `Delivery confirmed and invoice created, but the email failed: ${emailResult?.error}`
    );
    load();
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <PageHeader
        title="Pipeline Board"
        subtitle="Drag a card to move it manually — it also moves itself as RFQs progress elsewhere."
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-emerald-700 bg-emerald-400/10 border border-emerald-400/20 rounded-[10px] px-3 py-2">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const stageCards = cards.filter((c) => c.status === stage.key);
          return (
            <Card
              key={stage.key}
              noPadding
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.key);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage.key ? null : s))}
              onDrop={(e) => handleDrop(e, stage.key)}
              className={`p-3 min-h-[200px] transition-colors ${
                dragOverStage === stage.key ? "border-accent bg-accent/5" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <p
                  className="uppercase text-accent font-medium"
                  style={{ fontSize: 11, letterSpacing: "0.06em" }}
                >
                  {stage.label}
                </p>
                <span className="text-xs text-ink-muted tabular-nums">{stageCards.length}</span>
              </div>
              <div className="space-y-2">
                {stageCards.map((card) => (
                  <PipelineCard
                    key={card.id}
                    card={card}
                    onReceivePo={stage.key === "quoted" ? () => setPoReceiptCard(card) : null}
                    onConfirmDelivery={stage.key === "awarded" ? () => setDeliveryCard(card) : null}
                  />
                ))}
                {stageCards.length === 0 && (
                  <p className="text-xs text-ink-muted px-1 py-2">Nothing here.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {poReceiptCard && (
        <PoReceiptModal
          card={poReceiptCard}
          onClose={() => setPoReceiptCard(null)}
          onSaved={handlePoSaved}
        />
      )}
      {deliveryCard && (
        <ConfirmDeliveryModal
          card={deliveryCard}
          onClose={() => setDeliveryCard(null)}
          onSaved={handleDeliverySaved}
        />
      )}
    </div>
  );
}

function PipelineCard({ card, onReceivePo, onConfirmDelivery }) {
  const urgency = urgencyFor(card.closingDate);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
      className={`border-l-2 ${URGENCY_STYLES[urgency]} bg-base-800 border-[0.5px] border-line rounded-[10px] px-3 py-2.5 cursor-grab active:cursor-grabbing hover:border-line-strong`}
    >
      <p className="text-white font-medium truncate" style={{ fontSize: 11 }}>
        {card.clientName}
      </p>
      <p className="text-ink-muted truncate mt-0.5" style={{ fontSize: 10 }}>
        {card.rfqNumber || card.title}
        {card.closingDate ? ` · Closes ${card.closingDate}` : ""}
      </p>
      <div className="flex items-center justify-end mt-1.5">
        <Badge variant="gray">
          {card.lineCount} line{card.lineCount === 1 ? "" : "s"}
        </Badge>
      </div>
      {onReceivePo && (
        <Button variant="primary" onClick={onReceivePo} className="w-full mt-2 !text-xs !py-1.5">
          Receive PO
        </Button>
      )}
      {onConfirmDelivery && (
        <Button variant="primary" onClick={onConfirmDelivery} className="w-full mt-2 !text-xs !py-1.5 !bg-emerald-500">
          Confirm Delivery
        </Button>
      )}
    </div>
  );
}
