import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { parseRfqText, parseRfqFile, matchOnly, RFQ_FILE_TYPES, rfqFileType } from "../lib/parseRfq";
import { confirmRfq } from "../lib/rfqIntake";
import { PageHeader, Card, Button, EmptyState } from "../components/ui";
import FileDropOverlay, { useFileDrop } from "../components/FileDropOverlay";
import Toast, { useToast } from "../components/Toast";

const TABS = [
  { key: "paste", label: "Paste Email" },
  { key: "upload", label: "Upload PDF/Image" },
  { key: "webhook", label: "iOS Shortcut Webhook" },
];

export default function Intake() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project_id");
  const [tab, setTab] = useState("paste");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [review, setReview] = useState(null); // { rfq, lines, queueId? }
  const [pendingQueue, setPendingQueue] = useState([]);
  const [parsingName, setParsingName] = useState(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    if (tab === "webhook") loadPendingQueue();
  }, [tab]);

  async function loadPendingQueue() {
    const { data } = await supabase
      .from("intake_queue")
      .select("*")
      .eq("source", "webhook")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingQueue(data ?? []);
  }

  function startReview(result, extra = {}) {
    setReview({
      rfq: { ...result.rfq },
      lines: result.lines.map((l) => ({
        ...l,
        acceptedMatchId:
          l.matches?.find((m) => m.similarity >= 0.5)?.id ?? null,
      })),
      ...extra,
    });
  }

  async function handleParseText(e) {
    e.preventDefault();
    if (!pasteText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await parseRfqText(pasteText);
      startReview(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function parseFile(file) {
    setBusy(true);
    setError(null);
    setParsingName(file.name);
    try {
      const result = await parseRfqFile(file);
      startReview(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setParsingName(null);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await parseFile(file);
    e.target.value = "";
  }

  const dragging = useFileDrop((files) => {
    const file = files[0];
    if (!RFQ_FILE_TYPES.includes(rfqFileType(file))) {
      showToast(`Unsupported file type${file.name ? ` (${file.name})` : ""}. Drop a JPEG, PNG, WebP, HEIC image or a PDF.`, "error");
      return;
    }
    if (busy) {
      showToast("Still parsing the previous file — try again in a moment.", "error");
      return;
    }
    if (review) {
      showToast("Confirm or cancel the RFQ under review before dropping another file.", "error");
      return;
    }
    parseFile(file);
  });

  async function handleReviewQueueItem(row) {
    setBusy(true);
    setError(null);
    try {
      const result = await matchOnly(row.parsed);
      startReview(result, { queueId: row.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const { downstream } = await confirmRfq({ ...review, projectId });
      if (review.queueId) {
        await supabase.from("intake_queue").update({ status: "confirmed" }).eq("id", review.queueId);
        loadPendingQueue();
      }
      const parts = ["RFQ created."];
      parts.push(downstream.clickup?.ok ? "ClickUp task created." : `ClickUp: ${downstream.clickup?.error ?? "skipped"}.`);
      if (downstream.calendar) {
        parts.push(downstream.calendar.ok ? "Calendar event created." : `Calendar: ${downstream.calendar.error}.`);
      }
      setReview(null);
      setPasteText("");
      setError(null);
      alert(parts.join(" "));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const webhookUrl = `${window.location.origin}/api/intake`;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="New RFQ"
        subtitle="Paste an email, upload a PDF or image, or receive one from the iOS Shortcut webhook."
      />

      <FileDropOverlay show={dragging} text="Drop your RFQ image or PDF here" />
      <Toast toast={toast} />

      {projectId && (
        <p className="text-xs text-ink-secondary">This RFQ will be linked to the project you came from.</p>
      )}

      {parsingName && (
        <div className="flex items-center gap-3 rounded-[10px] border border-line bg-base-900 px-4 py-3 text-sm text-ink-secondary">
          <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
          Parsing {parsingName} with Claude…
        </div>
      )}

      {!review && (
        <>
          <div className="flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? "border-accent text-white"
                    : "border-transparent text-ink-secondary hover:text-ink-secondary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
              {error}
            </p>
          )}

          {tab === "paste" && (
            <form onSubmit={handleParseText} className="space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={12}
                placeholder="Paste the RFQ email text here…"
                className="w-full rounded-[10px] bg-base-900 border border-line px-4 py-3 text-sm text-white placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
              <Button type="submit" variant="primary" disabled={busy || !pasteText.trim()}>
                {busy ? "Parsing…" : "Parse with Claude"}
              </Button>
            </form>
          )}

          {tab === "upload" && (
            <div className="rounded-[10px] border border-dashed border-line-strong bg-base-900 p-10 text-center">
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,.heic"
                onChange={handleFile}
                disabled={busy}
                className="block mx-auto text-sm text-ink-secondary"
              />
              <p className="text-xs text-ink-muted mt-3">
                {busy ? "Parsing…" : "PDF or image of an RFQ — or drag one anywhere onto this page."}
              </p>
            </div>
          )}

          {tab === "webhook" && (
            <div className="space-y-4">
              <Card className="text-sm text-ink-secondary space-y-2">
                <p className="text-white font-medium">iOS Shortcut setup</p>
                <p>
                  POST JSON to <code className="text-accent">{webhookUrl}</code> with header{" "}
                  <code className="text-accent">x-intake-secret</code> set to the value in{" "}
                  <code className="text-ink-secondary">INTAKE_WEBHOOK_SECRET</code> (Cloudflare Pages
                  Function env var — see README).
                </p>
                <p>
                  Body shape:{" "}
                  <code className="text-ink-secondary">
                    {`{ "client_name", "rfq_reference", "closing_date", "line_items": [...] }`}
                  </code>
                </p>
              </Card>
              <div>
                <p className="text-sm font-medium text-ink-secondary mb-2">
                  Pending ({pendingQueue.length})
                </p>
                {pendingQueue.length === 0 ? (
                  <EmptyState title="No pending submissions" subtitle="Webhook intake will show up here." />
                ) : (
                  <ul className="space-y-2">
                    {pendingQueue.map((row) => (
                      <li key={row.id}>
                        <Card className="flex items-center justify-between">
                          <div className="text-sm text-ink-secondary">
                            {row.parsed?.client_name || "Unknown client"} —{" "}
                            {row.parsed?.rfq_reference || "no reference"}
                          </div>
                          <Button variant="primary" disabled={busy} onClick={() => handleReviewQueueItem(row)}>
                            Review
                          </Button>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {review && (
        <RfqReviewForm
          review={review}
          setReview={setReview}
          busy={busy}
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => setReview(null)}
        />
      )}
    </div>
  );
}

function RfqReviewForm({ review, setReview, busy, error, onConfirm, onCancel }) {
  const { rfq, lines } = review;

  function updateRfq(field, value) {
    setReview({ ...review, rfq: { ...rfq, [field]: value } });
  }

  function updateLine(index, field, value) {
    const next = [...lines];
    next[index] = { ...next[index], [field]: value };
    setReview({ ...review, lines: next });
  }

  function toggleMatch(index, matchId) {
    const next = [...lines];
    const current = next[index].acceptedMatchId;
    next[index] = { ...next[index], acceptedMatchId: current === matchId ? null : matchId };
    setReview({ ...review, lines: next });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <p className="text-sm font-semibold text-white">Review before confirming</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Client name">
            <input
              value={rfq.client_name ?? ""}
              onChange={(e) => updateRfq("client_name", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="RFQ reference">
            <input
              value={rfq.rfq_reference ?? ""}
              onChange={(e) => updateRfq("rfq_reference", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Closing date">
            <input
              type="date"
              value={rfq.closing_date ?? ""}
              onChange={(e) => updateRfq("closing_date", e.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-white">Line items ({lines.length})</p>
        {lines.map((line, i) => (
          <Card key={i} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px] gap-2">
              <input
                value={line.description}
                onChange={(e) => updateLine(i, "description", e.target.value)}
                className="input"
                placeholder="Description"
              />
              <input
                type="number"
                value={line.quantity ?? ""}
                onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                className="input"
                placeholder="Qty"
              />
              <input
                value={line.unit ?? ""}
                onChange={(e) => updateLine(i, "unit", e.target.value)}
                className="input"
                placeholder="Unit"
              />
            </div>

            {line.matches?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Previous matches
                </p>
                {line.matches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMatch(i, m.id)}
                    className={`w-full text-left rounded-[10px] px-3 py-2 text-xs border transition-colors ${
                      line.acceptedMatchId === m.id
                        ? "border-emerald-400/50 bg-emerald-400/10"
                        : "border-line bg-base-800 hover:border-line-strong"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white">
                        {m.part_number || m.description} ({Math.round(m.similarity * 100)}% match)
                      </span>
                      {line.acceptedMatchId === m.id && (
                        <span className="text-emerald-700">Using this match</span>
                      )}
                    </div>
                    {m.recent_quotes?.length > 0 && (
                      <div className="mt-1 text-ink-secondary">
                        {m.recent_quotes
                          .map((q) => `${q.supplierName}: $${q.unitPrice ?? "?"}`)
                          .join(" · ")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="primary" onClick={onConfirm} disabled={busy}>
          {busy ? "Confirming…" : "Confirm & Create RFQ"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-secondary mb-1">{label}</span>
      {children}
    </label>
  );
}
