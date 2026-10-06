import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./DealDetail.css";
import { supabase } from "../lib/supabaseClient";
import { fetchFxRate, DEFAULT_FX_RATE } from "../lib/settings";
import { fetchLinesWithQuotes } from "../lib/sourcing";
import { DEAL_STATUSES, dealStatusKey, dealStatusMeta, isPipelineStatus } from "../lib/deals";
import { VAT_TYPES, money, todayISO, daysSince, projectPnl } from "../lib/projects";
import {
  Pill,
  StatusBadge,
  Field,
  PlInput,
  PlCalcRow,
  InsightPanel,
  QuotationsTab,
  ExpensesTab,
  DocumentsTab,
  ArrowLeft,
  fmtDay,
  fmtDate,
} from "../components/detail/shared";

// Deal detail page for a Pipeline card (/deals/:id). Deals are a separate
// domain from Planning projects: they hang off an RFQ, never a project.

const TABS = ["Overview", "RFQ Lines", "Quotations", "Sourcing", "Expenses", "Documents"];
const PAYMENT_TERMS = ["30 Days", "60 Days", "COD", "Upon Delivery", "50% DP / 50% Balance"];
const PAYMENT_STATUSES = ["Unpaid", "Paid", "Overdue"];
const PAYMENT_TONE = {
  Unpaid: { fg: "#b45309", bg: "#fef3c7" },
  Paid: { fg: "#15803d", bg: "#dcfce7" },
  Overdue: { fg: "#b91c1c", bg: "#fee2e2" },
};

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState(null);
  const [rfq, setRfq] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [saved, setSaved] = useState({});
  const [lines, setLines] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [pos, setPos] = useState([]);
  const [supplierQuotes, setSupplierQuotes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [docs, setDocs] = useState([]);
  const [fxRate, setFxRate] = useState(DEFAULT_FX_RATE);
  const [poForm, setPoForm] = useState(false);
  const flashTimers = useRef({});

  const loadDeal = useCallback(async () => {
    const { data, error: e } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    if (e) return setLoadError(e.message);
    if (!data) return setLoadError("Deal not found.");
    // rfqs.status is what moves the Pipeline card (Sourcing Desk, Quote Builder, drags), so
    // pull a newer status onto the deal. A deal marked invoiced stays there while its RFQ is delivered.
    let next = data;
    if (data.rfq_id) {
      const { data: r } = await supabase.from("rfqs").select("id, status, client_id").eq("id", data.rfq_id).maybeSingle();
      setRfq(r ?? null);
      const behind = r && isPipelineStatus(r.status) && dealStatusKey(r.status) !== dealStatusKey(data.status);
      if (behind && !(data.status === "invoiced" && r.status === "delivered")) {
        const patch = { status: r.status, stage: r.status, stage_changed_at: new Date().toISOString() };
        await supabase.from("deals").update(patch).eq("id", id);
        next = { ...data, ...patch };
      }
    }
    setDeal(next);
  }, [id]);

  const loadLinked = useCallback(
    async (rfqId) => {
      const [ex, d] = await Promise.all([
        supabase.from("deal_expenses").select("*").eq("deal_id", id).order("date", { ascending: false }),
        supabase.from("deal_documents").select("*").eq("deal_id", id).order("uploaded_at", { ascending: false }),
      ]);
      const firstErr = [ex, d].find((x) => x.error)?.error;
      if (firstErr) setError(firstErr.message);
      setExpenses(ex.data ?? []);
      setDocs(d.data ?? []);
      if (!rfqId) return;

      const [l, q] = await Promise.all([
        fetchLinesWithQuotes([rfqId]).then(
          (data) => ({ data, error: null }),
          (error) => ({ data: [], error })
        ),
        supabase.from("quotations").select("*, rfqs(id, closing_date, clients(name, address))").eq("rfq_id", rfqId).order("created_at", { ascending: false }),
      ]);
      if (l.error || q.error) setError((l.error ?? q.error).message);
      const lineRows = l.data ?? [];
      setLines(lineRows);
      setQuotes(q.data ?? []);
      setSupplierQuotes(
        lineRows.flatMap((line) =>
          (line.supplier_quotes ?? []).map((sq) => ({ ...sq, supplier: sq.suppliers?.name, part: line.description }))
        )
      );
      const quoteIds = (q.data ?? []).map((x) => x.id);
      if (quoteIds.length) {
        const { data: po } = await supabase
          .from("purchase_orders")
          .select("id, po_number, status, total_amount, order_date, expected_delivery_date")
          .in("quotation_id", quoteIds)
          .order("order_date", { ascending: false });
        setPos(po ?? []);
      } else setPos([]);
    },
    [id]
  );

  useEffect(() => {
    loadDeal();
    fetchFxRate().then(setFxRate).catch(() => {});
  }, [loadDeal]);
  const rfqId = deal?.rfq_id;
  useEffect(() => {
    if (deal) loadLinked(rfqId);
  }, [loadLinked, rfqId, deal === null]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => loadLinked(rfqId), [loadLinked, rfqId]);

  // ---- Saving ------------------------------------------------------------------
  const flash = (field) => {
    setSaved((s) => ({ ...s, [field]: true }));
    clearTimeout(flashTimers.current[field]);
    flashTimers.current[field] = setTimeout(() => setSaved((s) => ({ ...s, [field]: false })), 1500);
  };
  useEffect(() => () => Object.values(flashTimers.current).forEach(clearTimeout), []);

  const save = async (patch, flashKey) => {
    setDeal((d) => ({ ...d, ...patch }));
    const { error: e } = await supabase.from("deals").update(patch).eq("id", id);
    if (e) {
      setError(`Couldn't save: ${e.message}`);
      loadDeal();
    } else flash(flashKey ?? Object.keys(patch)[0]);
  };
  const set = (patch) => setDeal((d) => ({ ...d, ...patch }));
  const saveNumber = (field) => save({ [field]: Number(deal[field]) || 0 }, field);

  const saveStatus = async (key) => {
    await save({ status: key, stage: key, stage_changed_at: new Date().toISOString() }, "status");
    // Keep the Pipeline card in the matching column ("invoiced" has no column, so the card stays put).
    if (deal.rfq_id && isPipelineStatus(key)) {
      const { error: e } = await supabase.from("rfqs").update({ status: key }).eq("id", deal.rfq_id);
      if (e) setError(`Deal saved, but the Pipeline card didn't move: ${e.message}`);
      else setRfq((r) => (r ? { ...r, status: key } : r));
    }
  };


  if (loadError)
    return (
      <div className="pd-page">
        <button className="pd-back" onClick={() => navigate("/pipeline")}>
          <ArrowLeft /> Back to Pipeline
        </button>
        <div className="pd-error">{loadError}</div>
      </div>
    );
  if (!deal) return <div className="pd-page"><div className="pd-muted">Loading…</div></div>;

  const meta = dealStatusMeta(deal.status);
  const rfqQuery = (path) => `${path}?${deal.rfq_number ? `rfq_number=${encodeURIComponent(deal.rfq_number)}` : `rfq=${deal.rfq_id ?? ""}`}`;

  return (
    <div className="pd-page">
      <button className="pd-back" onClick={() => navigate("/pipeline")}>
        <ArrowLeft /> Back to Pipeline
      </button>

      <div className="pd-head">
        <span className="dd-title-wrap">
          <input
            className="pd-title"
            value={deal.title ?? ""}
            onChange={(e) => set({ title: e.target.value })}
            onBlur={() => save({ title: deal.title?.trim() || null }, "title")}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Deal title"
          />
          {saved.title && <b className="pd-check">✓</b>}
        </span>
        <div className="pd-head-right">
          <select
            className="pd-stage"
            style={{ color: meta.fg, background: meta.bg }}
            value={meta.key}
            onChange={(e) => saveStatus(e.target.value)}
            aria-label="Status"
          >
            {DEAL_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select
            className="pd-stage dd-vat"
            value={deal.vat_type ?? "VAT Inclusive"}
            onChange={(e) => save({ vat_type: e.target.value }, "vat_type")}
            aria-label="VAT type"
          >
            {VAT_TYPES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      {deal.rfq_number && <div className="pd-muted dd-sub">RFQ {deal.rfq_number}</div>}

      <div className="pd-actions">
        <button className="pd-btn pd-btn-amber" onClick={() => navigate(rfqQuery("/sourcing"))}>Source Items</button>
        <button className="pd-btn pd-btn-purple" onClick={() => navigate(rfqQuery("/quote-builder"))}>Generate Quotation</button>
        <button className="pd-btn pd-btn-outline" onClick={() => setPoForm((o) => !o)}>New Supplier PO</button>
        <button
          className="pd-btn dd-btn-green"
          disabled={meta.key === "delivered"}
          onClick={() => saveStatus("delivered")}
        >
          {meta.key === "delivered" ? "Delivered ✓" : "Mark Delivered"}
        </button>
      </div>

      {poForm && (
        <PoForm
          quoteId={quotes[0]?.id}
          clientId={rfq?.client_id}
          setError={setError}
          onDone={(created) => {
            setPoForm(false);
            if (created) reload();
          }}
        />
      )}

      {error && (
        <div className="pd-error" onClick={() => setError(null)}>
          {error} <span>✕</span>
        </div>
      )}

      <div className="pd-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`pd-tab${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <OverviewTab
          deal={deal}
          set={set}
          save={save}
          saveNumber={saveNumber}
          saved={saved}
          pos={pos}
          expenses={expenses}
          rfqCount={deal.rfq_id ? 1 : 0}
          quoteCount={quotes.length}
        />
      )}
      {tab === "RFQ Lines" && <LinesTab rfqId={deal.rfq_id} lines={lines} reload={reload} setError={setError} />}
      {tab === "Quotations" && (
        <div className="pd-stack">
          <QuotationsTab quotes={quotes} generateHref={rfqQuery("/quote-builder")} navigate={navigate} setError={setError} />
          {pos.length > 0 && (
            <div className="pd-card">
              <div className="pd-section-head"><h3>Purchase Orders</h3></div>
              {pos.map((p) => (
                <div key={p.id} className="pd-row">
                  <b>{p.po_number || "—"}</b>
                  <span className="pd-trunc">{money(p.total_amount)}</span>
                  <span className="pd-muted">Ordered {fmtDate(p.order_date)}</span>
                  <StatusBadge status={p.status} />
                  <span className="pd-muted">Delivery {fmtDate(p.expected_delivery_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === "Sourcing" && <SourcingTab rows={supplierQuotes} fxRate={fxRate} onSource={() => navigate(rfqQuery("/sourcing"))} />}
      {tab === "Expenses" && (
        <ExpensesTab table="deal_expenses" ownerCol="deal_id" ownerId={id} expenses={expenses} reload={reload} setError={setError} />
      )}
      {tab === "Documents" && (
        <DocumentsTab table="deal_documents" bucket="deal-documents" ownerCol="deal_id" ownerId={id} docs={docs} reload={reload} setError={setError} />
      )}
    </div>
  );
}

// ---- New Supplier PO ----------------------------------------------------------

function PoForm({ quoteId, clientId, onDone, setError }) {
  const [f, setF] = useState({ po_number: "", total_amount: "", order_date: todayISO(), expected_delivery_date: "" });
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.po_number.trim()) return setError("A PO needs a PO number.");
    // purchase_orders hang off a quotation, so a deal needs one before it can have a PO.
    if (!quoteId) return setError("Create a quotation for this deal first — purchase orders are linked through it.");
    const { error } = await supabase.from("purchase_orders").insert({
      quotation_id: quoteId,
      client_id: clientId ?? null,
      po_number: f.po_number.trim(),
      total_amount: Number(f.total_amount) || 0,
      order_date: f.order_date || null,
      expected_delivery_date: f.expected_delivery_date || null,
      status: "open",
    });
    if (error) return setError(`Couldn't create PO: ${error.message}`);
    onDone(true);
  };
  return (
    <div className="pd-card dd-po">
      <div className="pd-picker">
        <input className="pd-input" placeholder="PO number" value={f.po_number} onChange={on("po_number")} />
        <input className="pd-input" type="number" min="0" step="0.01" placeholder="Total (PHP)" value={f.total_amount} onChange={on("total_amount")} />
        <input className="pd-input" type="date" title="Order date" value={f.order_date} onChange={on("order_date")} />
        <input className="pd-input" type="date" title="Expected delivery" value={f.expected_delivery_date} onChange={on("expected_delivery_date")} />
        <button className="pd-btn pd-btn-blue pd-sm" onClick={submit}>Create</button>
        <button className="pd-link" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Overview -----------------------------------------------------------------

function OverviewTab({ deal, set, save, saveNumber, saved, pos, expenses, rfqCount, quoteCount }) {
  // Recomputed on every render, so edits in the Expenses tab show here at once.
  const pnl = projectPnl(deal.invoice_amount, expenses);
  const { invoice, profit, margin } = pnl;

  const input = (field, type = "text") => (
    <input
      className="pd-input"
      type={type}
      value={deal[field] ?? ""}
      onChange={(e) => set({ [field]: e.target.value })}
      onBlur={() => save({ [field]: deal[field] || null }, field)}
    />
  );
  const select = (field, options, fallback) => (
    <select className="pd-input" value={deal[field] ?? fallback} onChange={(e) => save({ [field]: e.target.value }, field)}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );

  const deliveryDate = pos.map((p) => p.expected_delivery_date).filter(Boolean).sort()[0] ?? null;
  const points = [
    ["Received", deal.received_date],
    ["Closing Date", deal.closing_date],
    ["PO Received", deal.po_date],
    ["Expected Delivery", deliveryDate],
    ["Invoice Date", deal.invoice_date],
    ["Payment Due", deal.payment_due_date],
  ];
  const today = todayISO();
  const dotState = (d) => (!d ? "none" : d === today ? "today" : d < today ? "past" : "future");
  const payTone = PAYMENT_TONE[deal.payment_status ?? "Unpaid"];

  return (
    <div className="pd-grid">
      <div className="pd-col">
        <div className="pd-card">
          <div className="pd-label">DEAL DETAILS</div>
          <div className="pd-fields">
            <Field label="Client" saved={saved.client_name}>{input("client_name")}</Field>
            <Field label="VAT Type" saved={saved.vat_type}>{select("vat_type", VAT_TYPES, "VAT Inclusive")}</Field>
            <Field label="Received Date" saved={saved.received_date}>{input("received_date", "date")}</Field>
            <Field label="Closing Date" saved={saved.closing_date}>{input("closing_date", "date")}</Field>
            <Field label="PO Date" saved={saved.po_date}>{input("po_date", "date")}</Field>
            <Field label="Invoice Date" saved={saved.invoice_date}>{input("invoice_date", "date")}</Field>
            <Field label="Payment Terms" saved={saved.payment_terms}>
              <select className="pd-input" value={deal.payment_terms ?? ""} onChange={(e) => save({ payment_terms: e.target.value || null }, "payment_terms")}>
                <option value="">—</option>
                {PAYMENT_TERMS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Payment Due Date" saved={saved.payment_due_date}>{input("payment_due_date", "date")}</Field>
            <Field label="Payment Status" saved={saved.payment_status}>
              <span className="dd-pay">
                {select("payment_status", PAYMENT_STATUSES, "Unpaid")}
                <Pill {...payTone}>{deal.payment_status ?? "Unpaid"}</Pill>
              </span>
            </Field>
          </div>
        </div>

        <div className="pd-card">
          <div className="pd-label">NOTES {saved.notes && <b className="pd-check">✓</b>}</div>
          <textarea
            className="pd-input pd-notes"
            placeholder="Add deal notes, context, or reminders..."
            value={deal.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
            onBlur={() => save({ notes: deal.notes || null }, "notes")}
          />
        </div>

        <div className="pd-card">
          <div className="pd-label">TIMELINE</div>
          <div className="pd-timeline-scroll">
            <div className="pd-timeline">
              {points.map(([label, date], i) => (
                <div key={label} className="pd-tl-step">
                  <div className="pd-tl-track">
                    <span className={`pd-tl-line${i === 0 ? " hide" : ""}`} />
                    <span className={`pd-tl-dot ${dotState(date)}`} />
                    <span className={`pd-tl-line${i === points.length - 1 ? " hide" : ""}`} />
                  </div>
                  <div className="pd-tl-label">{label}</div>
                  <div className="pd-tl-date">{date ? fmtDay(date) : "TBD"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pd-col">
        <div className="pd-card">
          <div className="pd-label">P&amp;L SUMMARY</div>

          <div className="pd-sublabel">REVENUE</div>
          <div className="pd-pl-row">
            <span className="pd-pl-name">Invoice Amount <Pill fg="#475569" bg="#f1f5f9">{deal.vat_type ?? "VAT Inclusive"}</Pill></span>
            <PlInput project={deal} field="invoice_amount" set={set} onSave={saveNumber} saved={saved.invoice_amount} />
          </div>

          {pnl.shippingRevenue > 0 && <PlCalcRow label="Shipping Revenue" value={pnl.shippingRevenue} minus={false} />}

          <div className="pd-sublabel pd-sublabel-costs">COSTS</div>
          <PlCalcRow label="COGS" value={pnl.cogs} />
          <PlCalcRow label="Shipping Cost" value={pnl.shipping} />
          <PlCalcRow label="Deal Expenses" value={pnl.other} />

          <hr className="pd-hr" />
          <div className="pd-pl-row">
            <b>GROSS PROFIT</b>
            <span className="pd-profit" style={{ color: profit >= 0 ? "#16a34a" : "#dc2626" }}>{money(profit)}</span>
          </div>
          <div className="pd-margin">Gross Margin {margin == null ? "—" : `${margin.toFixed(1)}%`}</div>
        </div>

        <InsightPanel
          cacheKey={`deal:${deal.id}`}
          buildData={() =>
            [
              `Deal: ${deal.title}${deal.rfq_number ? ` (RFQ ${deal.rfq_number})` : ""}`,
              `Client: ${deal.client_name || "unassigned"}`,
              `Stage: ${dealStatusMeta(deal.status).label}`,
              `Invoice amount: PHP ${invoice.toFixed(2)}`,
              `Gross profit: PHP ${profit.toFixed(2)}`,
              `Gross margin: ${margin == null ? "n/a" : `${margin.toFixed(1)}%`}`,
              `Deadline (closing date): ${deal.closing_date || "not set"}`,
              `Days since last activity: ${daysSince(deal.updated_at) ?? "unknown"}`,
              `Linked RFQs: ${rfqCount}`,
              `Quotations: ${quoteCount}`,
            ].join("\n")
          }
        />
      </div>
    </div>
  );
}

// ---- RFQ Lines ----------------------------------------------------------------

function LinesTab({ rfqId, lines, reload, setError }) {
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(null);

  const add = async () => {
    const next = Math.max(0, ...lines.map((l) => l.line_number ?? 0)) + 1;
    const { data, error } = await supabase
      .from("rfq_lines")
      .insert({ rfq_id: rfqId, line_number: next, description: "New line", quantity: 1, unit: "ea" })
      .select()
      .single();
    if (error) return setError(`Couldn't add line: ${error.message}`);
    await reload();
    setEditId(data.id);
    setEdit(data);
  };
  const commit = async () => {
    if (edit && edit.description?.trim()) {
      const { error } = await supabase
        .from("rfq_lines")
        .update({ description: edit.description.trim(), quantity: Number(edit.quantity) || 1, unit: edit.unit || "ea" })
        .eq("id", editId);
      if (error) setError(`Couldn't save line: ${error.message}`);
    }
    setEditId(null);
    reload();
  };
  const remove = async (line) => {
    if (!window.confirm(`Delete line ${line.line_number ?? ""} "${line.description}"? Its supplier quotes are deleted too.`)) return;
    const { error } = await supabase.from("rfq_lines").delete().eq("id", line.id);
    if (error) setError(`Couldn't delete line: ${error.message}`);
    reload();
  };

  if (!rfqId)
    return <div className="pd-card"><div className="pd-empty"><p>This deal isn't linked to an RFQ, so it has no line items.</p></div></div>;

  return (
    <div className="pd-card">
      <div className="pd-section-head">
        <h3>RFQ Lines</h3>
        <button className="pd-btn pd-btn-blue pd-sm" onClick={add}>Add Line</button>
      </div>
      {lines.length === 0 ? (
        <div className="pd-empty">
          <p>No line items on this RFQ yet.</p>
          <button className="pd-btn pd-btn-blue" onClick={add}>Add Line</button>
        </div>
      ) : (
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr><th>#</th><th>Description</th><th className="r">Quantity</th><th>Unit</th><th /></tr>
            </thead>
            <tbody>
              {lines.map((l) =>
                editId === l.id ? (
                  <tr key={l.id} className="pd-add-row">
                    <td>{l.line_number}</td>
                    <td><input className="pd-input" autoFocus value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></td>
                    <td><input className="pd-input pd-num" type="number" min="0" step="any" value={edit.quantity ?? ""} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} /></td>
                    <td><input className="pd-input" value={edit.unit ?? ""} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></td>
                    <td className="pd-nowrap">
                      <button className="pd-btn pd-btn-blue pd-sm" onClick={commit}>Save</button>{" "}
                      <button className="pd-link" onClick={() => setEditId(null)}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={l.id}
                    className="pd-click"
                    onClick={() => {
                      setEditId(l.id);
                      setEdit({ ...l });
                    }}
                  >
                    <td>{l.line_number}</td>
                    <td>{l.description}</td>
                    <td className="r">{l.quantity}</td>
                    <td>{l.unit}</td>
                    <td>
                      <button
                        className="pd-del"
                        title="Delete line"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(l);
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- Sourcing -----------------------------------------------------------------

function SourcingTab({ rows, fxRate, onSource }) {
  return (
    <div className="pd-card">
      <div className="pd-section-head">
        <h3>Supplier Quotes</h3>
        <button className="pd-btn pd-btn-amber pd-sm" onClick={onSource}>Source Items</button>
      </div>
      {rows.length === 0 ? (
        <div className="pd-empty">
          <p>No supplier quotes yet for this deal.</p>
          <button className="pd-btn pd-btn-amber" onClick={onSource}>Source Items</button>
        </div>
      ) : (
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr><th>Supplier</th><th>Part</th><th className="r">Unit Price (PHP)</th><th className="r">Lead Time</th><th>Currency</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.supplier ?? "—"}</td>
                  <td>{r.part}</td>
                  <td className="r">{r.unit_price != null ? money(Number(r.unit_price) * fxRate) : "—"}</td>
                  <td className="r">{r.lead_time_days != null ? `${r.lead_time_days} days` : "—"}</td>
                  {/* Supplier prices are entered in USD; PHP is converted at the current app FX rate. */}
                  <td>{r.unit_price != null ? `USD ${Number(r.unit_price).toFixed(2)}` : "—"}</td>
                  <td>{r.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
