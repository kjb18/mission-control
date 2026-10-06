import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchQuoteBuilderRfqs,
  fetchQuoteLines,
  fetchPrimaryContact,
  computeLine,
  computeTotals,
  recordQuotationAndMarkQuoted,
  buildCoverEmail,
  DEFAULT_MARKUP_PERCENT,
} from "../lib/quoteBuilder";
import { fetchFxRate, DEFAULT_FX_RATE } from "../lib/settings";
import { renderQuotationPdf } from "../lib/renderQuotation";
import QuoteLineTable from "./quoteBuilder/QuoteLineTable";
import TotalsPanel from "./quoteBuilder/TotalsPanel";
import QuotePdfPreview from "./quoteBuilder/QuotePdfPreview";
import SendQuotePanel from "./quoteBuilder/SendQuotePanel";
import { PageHeader, Card, CardHeader } from "../components/ui";

export default function QuoteBuilder() {
  const [searchParams] = useSearchParams();
  const [rfqs, setRfqs] = useState([]);
  const [rfqId, setRfqId] = useState(null);
  const [lines, setLines] = useState([]);
  const [markups, setMarkups] = useState({});
  const [contact, setContact] = useState(null);
  const [fxRate, setFxRate] = useState(DEFAULT_FX_RATE);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfMarkupSnapshot, setPdfMarkupSnapshot] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [approved, setApproved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Deep links: ?rfq=<id>, ?rfq_number=<n> (Deal page) or ?project_id=<id> preselects an RFQ.
    fetchQuoteBuilderRfqs()
      .then((list) => {
        setRfqs(list);
        const wanted = searchParams.get("rfq");
        const projectId = searchParams.get("project_id");
        const rfqNumber = searchParams.get("rfq_number");
        const match = (wanted && list.find((r) => r.id === wanted)) || (rfqNumber && list.find((r) => r.rfq_number === rfqNumber)) || (projectId && list.find((r) => r.project_id === projectId));
        if (match) setRfqId(match.id);
      })
      .catch((e) => setError(e.message));
    fetchFxRate().then(setFxRate).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rfqId) return;
    setError(null);
    setPdfUrl(null);
    setApproved(false);
    setSent(false);
    Promise.all([fetchQuoteLines(rfqId)])
      .then(([lineData]) => {
        setLines(lineData);
        setMarkups(Object.fromEntries(lineData.map((l) => [l.id, DEFAULT_MARKUP_PERCENT])));
      })
      .catch((e) => setError(e.message));
  }, [rfqId]);

  const selectedRfq = rfqs.find((r) => r.id === rfqId) ?? null;

  useEffect(() => {
    if (!selectedRfq) return;
    fetchPrimaryContact(selectedRfq.client_id).then(setContact).catch(() => setContact(null));
  }, [selectedRfq]);

  const computed = useMemo(() => {
    const map = {};
    for (const line of lines) {
      map[line.id] = computeLine(line, fxRate, markups[line.id]);
    }
    return map;
  }, [lines, markups, fxRate]);

  const totals = useMemo(() => computeTotals(Object.values(computed)), [computed]);

  const markupKey = JSON.stringify(markups);
  const stale = Boolean(pdfUrl) && pdfMarkupSnapshot !== markupKey;

  const email = useMemo(
    () => (selectedRfq ? buildCoverEmail({ rfq: selectedRfq, contact, totals }) : { subject: "", body: "" }),
    [selectedRfq, contact, totals]
  );

  function handleMarkupChange(lineId, value) {
    setMarkups((m) => ({ ...m, [lineId]: value === "" ? "" : Number(value) }));
  }

  function buildLineItems() {
    return lines.map((line, i) => {
      const c = computed[line.id];
      return {
        item_no: i + 1,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price_php: c.sellPrice,
        total_php: c.lineTotal,
      };
    });
  }

  async function handleGeneratePdf() {
    if (!selectedRfq) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await renderQuotationPdf({
        rfq: selectedRfq,
        contact,
        lineItems: buildLineItems(),
        totals,
        quoteNumber: selectedRfq.rfq_number,
      });
      setPdfUrl(result.pdfUrl);
      setPdfMarkupSnapshot(markupKey);
      setApproved(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!selectedRfq || sending || sent) return;
    setSending(true);
    setError(null);
    try {
      await recordQuotationAndMarkQuoted({
        rfq: selectedRfq,
        lineItems: buildLineItems(),
        totals,
        fxRate,
        pdfUrl,
      });
      setSent(true);
      setRfqs((prev) => prev.filter((r) => r.id !== selectedRfq.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader title="Build a Quotation" subtitle="Sourced RFQs, ready to price and send." />

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <Card>
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">RFQ (status: sourced)</span>
          <select value={rfqId ?? ""} onChange={(e) => setRfqId(e.target.value || null)} className="input">
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
            No RFQs are ready to quote. Finish sourcing one on the Sourcing Desk first.
          </p>
        )}
      </Card>

      {selectedRfq && lines.length > 0 && (
        <>
          <Card noPadding>
            <CardHeader title="Line Items" />
            <div className="px-5 py-4">
              <QuoteLineTable
                lines={lines}
                markups={markups}
                onMarkupChange={handleMarkupChange}
                computed={computed}
              />
            </div>
          </Card>

          <TotalsPanel totals={totals} />

          <Card noPadding>
            <CardHeader title="PDF Preview" />
            <div className="px-5 py-4">
              <QuotePdfPreview
                pdfUrl={pdfUrl}
                generating={generating}
                approved={approved}
                onGenerate={handleGeneratePdf}
                onApprove={setApproved}
                stale={stale}
              />
            </div>
          </Card>

          <Card noPadding>
            <CardHeader title="Send Quotation" />
            <div className="px-5 py-4">
              <SendQuotePanel
                contact={contact}
                email={email}
                approved={approved && !stale}
                sending={sending}
                sent={sent}
                onSend={handleSend}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
