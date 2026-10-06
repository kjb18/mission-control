import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  STAGES,
  QUOTE_EXPIRY_DAYS,
  fetchPipelineRfqs,
  updateRfqStage,
  urgencyFor,
  subscribeToRfqChanges,
  autoRejectStaleQuotes,
  stageOf,
} from "../lib/pipeline";
import PoReceiptModal from "./pipeline/PoReceiptModal";
import ConfirmDeliveryModal from "./pipeline/ConfirmDeliveryModal";
import { ensureDealsForRfqs } from "../lib/deals";
import { PageHeader, Card, Badge, Button } from "../components/ui";

const URGENCY_STYLES = {
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  green: "border-l-blue-500",
  none: "border-l-blue-500",
};

export default function Pipeline() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [poReceiptCard, setPoReceiptCard] = useState(null);
  const [deliveryCard, setDeliveryCard] = useState(null);

  const load = useCallback(() => {
    // Every RFQ gets a deal (once) before the cards are read, so each card can link to it.
    ensureDealsForRfqs()
      .catch((e) => console.warn("[Pipeline] creating deals failed:", e.message))
      .then(fetchPipelineRfqs)
      .then(setCards)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    autoRejectStaleQuotes()
      .then((numbers) => {
        if (numbers.length) {
          setNotice(`Auto-rejected after ${QUOTE_EXPIRY_DAYS} days without an award: ${numbers.join(", ")}`);
          load();
        }
      })
      .catch((e) => console.warn("[Pipeline] auto-rejection check failed:", e.message));
  }, [load]);

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
    const card = cards.find((c) => c.id === rfqId);
    if (card && stageOf(card.status) === stageKey) return; // same column — keep its exact status
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-4">
        {STAGES.map((stage) => {
          const stageCards = cards.filter((c) => stageOf(c.status) === stage.key);
          const tone = stage.tone === "red" ? { bg: "#fef2f2", border: "#ef4444", text: "#b91c1c" } : stage.tone === "purple" ? { bg: "#f5f3ff", border: "#7c3aed", text: "#6d28d9" } : null;
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
              style={tone && dragOverStage !== stage.key ? { background: tone.bg } : undefined}
            >
              <div
                className="flex items-center justify-between mb-3 px-1"
                style={tone ? { borderLeft: `2px solid ${tone.border}`, paddingLeft: 8 } : undefined}
              >
                <p
                  className={`uppercase font-medium ${tone ? "" : "text-accent"}`}
                  style={{ fontSize: 11, letterSpacing: "0.06em", ...(tone ? { color: tone.text } : {}) }}
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
                    onOpen={() => (card.dealId ? navigate(`/deals/${card.dealId}`) : setError("This RFQ has no deal yet — reload the page."))}
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

function PipelineCard({ card, onOpen, onReceivePo, onConfirmDelivery }) {
  const urgency = urgencyFor(card.closingDate);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
      onClick={onOpen}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen()}
      className={`border-l-2 ${URGENCY_STYLES[urgency]} bg-base-800 border-[0.5px] border-line rounded-[10px] pl-3 pr-2 py-2.5 cursor-pointer hover:bg-slate-100 hover:border-line-strong transition-colors`}
    >
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-white font-medium truncate" style={{ fontSize: 11 }}>
            {card.clientName}
          </p>
          <p className="text-ink-muted truncate mt-0.5" style={{ fontSize: 10 }}>
            {card.rfqNumber || card.title}
            {card.closingDate ? ` · Closes ${card.closingDate}` : ""}
          </p>
        </div>
        <svg className="shrink-0 text-ink-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-1.5 pr-1">
        {card.status === "sourced" && <Badge variant="green">Ready to quote</Badge>}
        <Badge variant="gray">
          {card.lineCount} line{card.lineCount === 1 ? "" : "s"}
        </Badge>
      </div>
      {onReceivePo && (
        <Button variant="primary" onClick={(e) => { e.stopPropagation(); onReceivePo(); }} className="w-full mt-2 !text-xs !py-1.5">
          Receive PO
        </Button>
      )}
      {onConfirmDelivery && (
        <Button variant="primary" onClick={(e) => { e.stopPropagation(); onConfirmDelivery(); }} className="w-full mt-2 !text-xs !py-1.5 !bg-emerald-500">
          Confirm Delivery
        </Button>
      )}
    </div>
  );
}
