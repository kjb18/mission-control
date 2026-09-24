import { useCallback, useEffect, useState } from "react";
import { STAGES, fetchPipelineRfqs, updateRfqStage, urgencyFor, subscribeToRfqChanges } from "../lib/pipeline";

const URGENCY_STYLES = {
  red: "border-l-red-400",
  amber: "border-l-amber-400",
  green: "border-l-emerald-400",
  none: "border-l-white/10",
};

export default function Pipeline() {
  const [cards, setCards] = useState([]);
  const [error, setError] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

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

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">Pipeline</p>
        <h1 className="text-2xl font-semibold text-white">Pipeline Board</h1>
        <p className="text-sm text-white/40 mt-1">
          Drag a card to move it manually — it also moves itself as RFQs progress elsewhere.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const stageCards = cards.filter((c) => c.status === stage.key);
          return (
            <div
              key={stage.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.key);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage.key ? null : s))}
              onDrop={(e) => handleDrop(e, stage.key)}
              className={`rounded-2xl border bg-base-900 p-3 min-h-[200px] transition-colors ${
                dragOverStage === stage.key ? "border-accent bg-accent/5" : "border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-sm font-semibold text-white">{stage.label}</p>
                <span className="text-xs text-white/30">{stageCards.length}</span>
              </div>
              <div className="space-y-2">
                {stageCards.map((card) => (
                  <PipelineCard key={card.id} card={card} />
                ))}
                {stageCards.length === 0 && (
                  <p className="text-xs text-white/20 px-1 py-2">Nothing here.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineCard({ card }) {
  const urgency = urgencyFor(card.closingDate);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
      className={`border-l-4 ${URGENCY_STYLES[urgency]} bg-base-800 border border-white/10 rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing hover:border-white/20`}
    >
      <p className="text-sm text-white/85 font-medium truncate">{card.clientName}</p>
      <p className="text-xs text-white/50 truncate">{card.rfqNumber || card.title}</p>
      <div className="flex items-center justify-between mt-1.5 text-[11px] text-white/40">
        <span>{card.closingDate ? `Closes ${card.closingDate}` : "No closing date"}</span>
        <span>{card.lineCount} line{card.lineCount === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
