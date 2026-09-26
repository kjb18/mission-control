import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchSourcingDeskRfqs,
  fetchRfqLines,
  fetchSuppliers,
  fetchSupplierQuotes,
  addManualQuote,
  selectSupplierQuote,
  maybeMarkRfqSourced,
} from "../lib/sourcing";
import { fetchPriceHistory } from "../lib/priceHistory";
import { fetchFxRate, DEFAULT_FX_RATE } from "../lib/settings";
import SupplierComparisonGrid from "./sourcing/SupplierComparisonGrid";
import ManualQuoteForm from "./sourcing/ManualQuoteForm";
import OutreachPanel from "./sourcing/OutreachPanel";
import PriceHistoryPanel from "./sourcing/PriceHistoryPanel";

export default function Sourcing() {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState([]);
  const [rfqId, setRfqId] = useState(null);
  const [lines, setLines] = useState([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fxRate, setFxRate] = useState(DEFAULT_FX_RATE);

  useEffect(() => {
    fetchSourcingDeskRfqs().then(setRfqs).catch((e) => setError(e.message));
    fetchSuppliers().then(setSuppliers).catch(() => {});
    fetchFxRate().then(setFxRate).catch(() => {});
  }, []);

  const loadLines = useCallback(async (id) => {
    const data = await fetchRfqLines(id);
    setLines(data);
    setLineIndex(0);
  }, []);

  useEffect(() => {
    if (!rfqId) return;
    setError(null);
    loadLines(rfqId).catch((e) => setError(e.message));
  }, [rfqId, loadLines]);

  const currentLine = lines[lineIndex] ?? null;

  const loadLineData = useCallback(async (line) => {
    if (!line) {
      setQuotes([]);
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    const [quoteData, historyData] = await Promise.all([
      fetchSupplierQuotes(line.id),
      fetchPriceHistory(line),
    ]);
    setQuotes(quoteData);
    setHistory(historyData);
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    loadLineData(currentLine).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLine?.id]);

  async function refreshQuotes() {
    if (!currentLine) return;
    setQuotes(await fetchSupplierQuotes(currentLine.id));
  }

  async function handleSelectQuote(quoteId) {
    if (!currentLine) return;
    setBusy(true);
    setError(null);
    try {
      await selectSupplierQuote(currentLine.id, quoteId);
      const updatedLines = await fetchRfqLines(rfqId);
      setLines(updatedLines);
      await refreshQuotes();
      await maybeMarkRfqSourced(rfqId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleManualQuote(payload) {
    if (!currentLine) return;
    await addManualQuote(currentLine.id, payload);
    await refreshQuotes();
  }

  const allSourced = lines.length > 0 && lines.every((l) => l.status === "sourced");
  const selectedRfq = rfqs.find((r) => r.id === rfqId);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">
          Sourcing
        </p>
        <h1 className="text-2xl font-semibold text-white">Sourcing Desk</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Work one confirmed RFQ, one line item, at a time.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">RFQ (awaiting or in sourcing)</span>
          <select
            value={rfqId ?? ""}
            onChange={(e) => setRfqId(e.target.value || null)}
            className="input"
          >
            <option value="">Select an RFQ…</option>
            {rfqs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.clientName ?? "Unknown client"} — {r.rfq_number || r.title}
                {r.closing_date ? ` (closes ${r.closing_date})` : ""}
              </option>
            ))}
          </select>
        </label>
        {rfqs.length === 0 && (
          <p className="text-xs text-ink-muted mt-2">
            No RFQs are waiting on sourcing. Confirm one in Intake first.
          </p>
        )}
      </div>

      {selectedRfq && allSourced && (
        <div className="rounded-[10px] border border-emerald-400/30 bg-emerald-400/10 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              All lines sourced — RFQ marked as sourced.
            </p>
            <p className="text-xs text-emerald-700/60 mt-0.5">
              Ready to build a client-facing quotation.
            </p>
          </div>
          <button
            onClick={() => navigate("/quote-builder")}
            className="px-4 py-2 rounded-[10px] bg-emerald-400 hover:bg-emerald-300 text-base-950 text-sm font-semibold shrink-0"
          >
            Proceed to Quote Builder
          </button>
        </div>
      )}

      {currentLine && (
        <>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setLineIndex((i) => Math.max(0, i - 1))}
              disabled={lineIndex === 0}
              className="text-sm text-ink-secondary hover:text-white disabled:opacity-30"
            >
              ← Prev
            </button>
            <p className="text-sm text-ink-secondary">
              Line {lineIndex + 1} of {lines.length}
            </p>
            <button
              onClick={() => setLineIndex((i) => Math.min(lines.length - 1, i + 1))}
              disabled={lineIndex === lines.length - 1}
              className="text-sm text-ink-secondary hover:text-white disabled:opacity-30"
            >
              Next →
            </button>
          </div>

          <div className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h2 className="text-lg font-semibold text-white">{currentLine.description}</h2>
              <span
                className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${
                  currentLine.status === "sourced"
                    ? "text-emerald-700 bg-emerald-400/15"
                    : "text-ink-secondary bg-base-800/60"
                }`}
              >
                {currentLine.status}
              </span>
            </div>
            <p className="text-sm text-ink-secondary">
              Qty {currentLine.quantity} {currentLine.unit}
            </p>
          </div>

          <section className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
            <h3 className="text-sm font-semibold text-white mb-3">Supplier Comparison</h3>
            <SupplierComparisonGrid
              quotes={quotes}
              line={currentLine}
              onSelect={handleSelectQuote}
              busy={busy}
              fxRate={fxRate}
            />
          </section>

          <section className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
            <h3 className="text-sm font-semibold text-white mb-3">Log a Supplier Reply</h3>
            <ManualQuoteForm suppliers={suppliers} onSave={handleManualQuote} busy={busy} />
          </section>

          <section className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
            <h3 className="text-sm font-semibold text-white mb-3">Supplier Outreach</h3>
            <OutreachPanel line={currentLine} suppliers={suppliers} />
          </section>

          <section className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
            <h3 className="text-sm font-semibold text-white mb-3">Price History</h3>
            <PriceHistoryPanel history={history} loading={historyLoading} />
          </section>
        </>
      )}
    </div>
  );
}
