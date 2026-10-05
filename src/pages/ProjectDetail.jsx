import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ProjectDetail.css";
import { supabase } from "../lib/supabaseClient";
import { renderQuotationPdf } from "../lib/renderQuotation";
import {
  PROJECT_STAGES,
  STAGE_COLORS,
  VAT_TYPES,
  VAT_RATE,
  stageOfProject,
  money,
  todayISO,
  daysSince,
  projectPnl,
  marginTone,
} from "../lib/projects";

const TABS = ["Overview", "RFQs and POs", "Quotations", "Sourcing", "Expenses", "Documents"];
const PAYMENT_TERMS = ["30 Days", "60 Days", "COD", "Upon Delivery", "50% DP / 50% Balance"];
const PAYMENT_STATUSES = ["Unpaid", "Paid", "Overdue"];
const EXPENSE_TYPES = ["COGS", "Shipping Cost", "Shipping Revenue", "Project Expense", "OpEx"];
const EXPENSE_COLORS = {
  COGS: { fg: "#b91c1c", bg: "#fee2e2" },
  "Shipping Cost": { fg: "#b45309", bg: "#fef3c7" },
  "Shipping Revenue": { fg: "#15803d", bg: "#dcfce7" },
  "Project Expense": { fg: "#1d4ed8", bg: "#dbeafe" },
  OpEx: { fg: "#6d28d9", bg: "#ede9fe" },
};
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000;
// Insights are cached per project for the life of the tab, so leaving the page and coming back doesn't regenerate.
const insightCache = new Map();

const fmtDay = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit" }) : null;
const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((b ?? 0) / 1024))} KB`);

const ArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const CloudUpload = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 16l-4-4-4 4M12 12v9" />
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
  </svg>
);

function Pill({ children, fg, bg, className = "" }) {
  return (
    <span className={`pd-pill ${className}`} style={{ color: fg, background: bg }}>
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = String(status ?? "").toLowerCase();
  const tone = /(won|award|deliver|paid|sent|accept|confirm|done|received)/.test(s)
    ? { fg: "#15803d", bg: "#dcfce7" }
    : /(reject|declin|lost|overdue|cancel)/.test(s)
      ? { fg: "#b91c1c", bg: "#fee2e2" }
      : /(sourc|quote|progress|draft)/.test(s)
        ? { fg: "#b45309", bg: "#fef3c7" }
        : { fg: "#475569", bg: "#f1f5f9" };
  return <Pill {...tone}>{String(status ?? "—").replace(/_/g, " ")}</Pill>;
}

/** Text input that filters a list; picking an option calls onPick(option). */
function Combobox({ value, onChange, onPick, onBlurText, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const q = (value ?? "").toLowerCase();
  const shown = options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8);
  return (
    <div className="pd-combo">
      <input
        className="pd-input"
        value={value ?? ""}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          onBlurText?.();
        }}
      />
      {open && shown.length > 0 && (
        <div className="pd-combo-list">
          {shown.map((o) => (
            <div
              key={o.id}
              className="pd-combo-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(o);
                setOpen(false);
              }}
            >
              {o.label}
              {o.sub && <span>{o.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [newPo, setNewPo] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState({});
  const [clients, setClients] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [pos, setPos] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [sourcing, setSourcing] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [docs, setDocs] = useState([]);
  const [missionCount, setMissionCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const flashTimers = useRef({});

  // ---- Loading -----------------------------------------------------------------
  const loadProject = useCallback(async () => {
    const { data, error: e } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (e) setLoadError(e.message);
    else if (!data) setLoadError("Project not found.");
    else setProject(data);
  }, [id]);

  const loadLinked = useCallback(async () => {
    const [r, p, ex, d, m, t] = await Promise.all([
      supabase.from("rfqs").select("id, rfq_number, title, status, received_date, closing_date, client_id, clients(name, address)").eq("project_id", id).order("received_date", { ascending: false }),
      supabase.from("purchase_orders").select("id, po_number, status, total_amount, order_date, expected_delivery_date").eq("project_id", id).order("order_date", { ascending: false }),
      supabase.from("project_expenses").select("*").eq("project_id", id).order("date", { ascending: false }),
      supabase.from("project_documents").select("*").eq("project_id", id).order("uploaded_at", { ascending: false }),
      supabase.from("missions").select("id", { count: "exact", head: true }).eq("project_id", id),
      supabase.from("work_items").select("id", { count: "exact", head: true }).eq("project_id", id),
    ]);
    const firstErr = [r, p, ex, d].find((x) => x.error)?.error;
    if (firstErr) setError(firstErr.message);
    const rfqRows = r.data ?? [];
    setRfqs(rfqRows);
    setPos(p.data ?? []);
    setExpenses(ex.data ?? []);
    setDocs(d.data ?? []);
    setMissionCount(m.count ?? 0);
    setTaskCount(t.count ?? 0);

    const rfqIds = rfqRows.map((x) => x.id);
    if (!rfqIds.length) {
      setQuotes([]);
      setSourcing([]);
      return;
    }
    const [q, lines] = await Promise.all([
      supabase.from("quotations").select("*, rfqs(id, closing_date, clients(name, address))").in("rfq_id", rfqIds).order("created_at", { ascending: false }),
      supabase.from("rfq_lines").select("id, rfq_id, line_number, description, quantity, unit, status, supplier_quotes(id, unit_price, brand, lead_time_days, status, created_at, quoted_at, suppliers(name))").in("rfq_id", rfqIds).order("line_number"),
    ]);
    setQuotes(q.data ?? []);
    // One sourcing "session" per linked RFQ: its lines and the supplier quotes gathered.
    setSourcing(
      rfqRows.map((rfq) => {
        const rfqLines = (lines.data ?? []).filter((l) => l.rfq_id === rfq.id);
        const sq = rfqLines.flatMap((l) => l.supplier_quotes ?? []);
        const started = sq.map((x) => x.created_at).filter(Boolean).sort()[0] ?? null;
        const suppliers = new Set(sq.map((x) => x.suppliers?.name).filter(Boolean));
        return { rfq, lines: rfqLines, supplierCount: suppliers.size, quoteCount: sq.length, started };
      })
    );
  }, [id]);

  useEffect(() => {
    loadProject();
    loadLinked();
    supabase.from("clients").select("id, name").order("name").then(({ data }) => setClients(data ?? []));
  }, [loadProject, loadLinked]);

  // ---- Saving ------------------------------------------------------------------
  const flash = (field) => {
    setSaved((s) => ({ ...s, [field]: true }));
    clearTimeout(flashTimers.current[field]);
    flashTimers.current[field] = setTimeout(() => setSaved((s) => ({ ...s, [field]: false })), 1500);
  };
  useEffect(() => () => Object.values(flashTimers.current).forEach(clearTimeout), []);

  const save = async (patch, flashKey) => {
    setProject((p) => ({ ...p, ...patch }));
    const { error: e } = await supabase.from("projects").update(patch).eq("id", id);
    if (e) {
      setError(`Couldn't save: ${e.message}`);
      loadProject();
    } else flash(flashKey ?? Object.keys(patch)[0]);
  };
  const set = (patch) => setProject((p) => ({ ...p, ...patch }));
  const saveStage = (stage) => save({ stage, stage_changed_at: new Date().toISOString() }, "stage");
  const saveNumber = (field) => save({ [field]: Number(project[field]) || 0 }, field);

  const expenseTotal = useMemo(
    () => expenses.filter((x) => x.type === "Project Expense" || x.type === "COGS").reduce((s, x) => s + Number(x.amount ?? 0), 0),
    [expenses]
  );

  if (loadError)
    return (
      <div className="pd-page">
        <button className="pd-back" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back to Planning
        </button>
        <div className="pd-error">{loadError}</div>
      </div>
    );
  if (!project) return <div className="pd-page"><div className="pd-muted">Loading…</div></div>;

  const stage = stageOfProject(project);
  const stageColor = STAGE_COLORS[stage];
  const vatType = project.vat_type ?? "VAT Inclusive";
  const qs = (extra = "") => `?project_id=${id}${extra}`;

  return (
    <div className="pd-page">
      <button className="pd-back" onClick={() => navigate(-1)}>
        <ArrowLeft /> Back to Planning
      </button>

      <div className="pd-head">
        <input
          className="pd-title"
          value={project.name ?? ""}
          onChange={(e) => set({ name: e.target.value })}
          onBlur={() => (project.name?.trim() ? save({ name: project.name.trim() }) : loadProject())}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Project name"
        />
        <div className="pd-head-right">
          <select
            className="pd-stage"
            style={{ color: stageColor.fg, background: stageColor.bg }}
            value={stage}
            onChange={(e) => saveStage(e.target.value)}
            aria-label="Stage"
          >
            {PROJECT_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Pill fg="#475569" bg="#f1f5f9">{vatType}</Pill>
        </div>
      </div>

      <div className="pd-actions">
        <button className="pd-btn pd-btn-blue" onClick={() => navigate(`/intake${qs()}`)}>New RFQ</button>
        <button
          className="pd-btn pd-btn-outline"
          onClick={() => {
            setTab("RFQs and POs");
            setNewPo(true);
          }}
        >
          New Supplier PO
        </button>
        <button className="pd-btn pd-btn-amber" onClick={() => navigate(`/sourcing${qs()}`)}>Source Items</button>
        <button className="pd-btn pd-btn-purple" onClick={() => navigate(`/quote-builder${qs()}`)}>Generate Quotation</button>
      </div>

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
          project={project}
          set={set}
          save={save}
          saveStage={saveStage}
          saveNumber={saveNumber}
          saved={saved}
          clients={clients}
          rfqs={rfqs}
          pos={pos}
          quotes={quotes}
          sourcing={sourcing}
          expenseTotal={expenseTotal}
          missionCount={missionCount}
          taskCount={taskCount}
        />
      )}
      {tab === "RFQs and POs" && (
        <LinkedTab projectId={id} rfqs={rfqs} pos={pos} reload={loadLinked} setError={setError} navigate={navigate} newPo={newPo} setNewPo={setNewPo} />
      )}
      {tab === "Quotations" && <QuotationsTab quotes={quotes} projectId={id} navigate={navigate} setError={setError} />}
      {tab === "Sourcing" && <SourcingTab sessions={sourcing} projectId={id} navigate={navigate} />}
      {tab === "Expenses" && <ExpensesTab projectId={id} expenses={expenses} reload={loadLinked} setError={setError} />}
      {tab === "Documents" && <DocumentsTab projectId={id} docs={docs} reload={loadLinked} setError={setError} />}
    </div>
  );
}

// ============================ Tab 1: Overview ====================================

function Field({ label, saved, children }) {
  return (
    <label className="pd-field">
      <span className="pd-flabel">
        {label}
        {saved && <b className="pd-check">✓</b>}
      </span>
      {children}
    </label>
  );
}

function OverviewTab({ project, set, save, saveStage, saveNumber, saved, clients, rfqs, pos, quotes, sourcing, expenseTotal, missionCount, taskCount }) {
  const stage = stageOfProject(project);
  const { invoice, profit, margin } = projectPnl(project, expenseTotal);
  const vatType = project.vat_type ?? "VAT Inclusive";

  const text = (field, type = "text") => (
    <input
      className="pd-input"
      type={type}
      value={project[field] ?? ""}
      onChange={(e) => set({ [field]: e.target.value })}
      onBlur={() => save({ [field]: project[field] || null }, field)}
    />
  );
  const select = (field, options, fallback) => (
    <select className="pd-input" value={project[field] ?? fallback} onChange={(e) => save({ [field]: e.target.value }, field)}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );

  const clientOptions = clients.map((c) => ({ id: c.id, label: c.name }));

  // ---- Timeline ----
  const sourcingStart = sourcing.map((s) => s.started?.slice(0, 10)).filter(Boolean).sort()[0] ?? null;
  const sentDate = quotes.map((q) => q.sent_date).filter(Boolean).sort()[0] ?? null;
  const receivedDate = rfqs.map((r) => r.received_date).filter(Boolean).sort()[0] ?? null;
  const deliveryDate = pos.map((p) => p.expected_delivery_date).filter(Boolean).sort()[0] ?? null;
  const points = [
    ["RFQ Received", receivedDate],
    ["Sourcing Started", sourcingStart],
    ["Quotation Sent", sentDate],
    ["PO Received", project.po_date],
    ["Expected Delivery", deliveryDate],
    ["Invoice Date", project.invoice_date],
    ["Payment Due Date", project.payment_due_date],
  ];
  const today = todayISO();
  const dotState = (d) => (!d ? "none" : d === today ? "today" : d < today ? "past" : "future");

  return (
    <div className="pd-grid">
      <div className="pd-col">
        <div className="pd-card">
          <div className="pd-label">PROJECT DETAILS</div>
          <div className="pd-fields">
            <Field label="Client" saved={saved.client_name}>
              <Combobox
                value={project.client_name}
                placeholder="Search clients…"
                options={clientOptions}
                onChange={(v) => set({ client_name: v, client_id: null })}
                onPick={(o) => save({ client_id: o.id, client_name: o.label }, "client_name")}
                onBlurText={() => save({ client_name: project.client_name || null, client_id: project.client_id ?? null }, "client_name")}
              />
            </Field>
            <Field label="VAT Type" saved={saved.vat_type}>{select("vat_type", VAT_TYPES, "VAT Inclusive")}</Field>
            <Field label="Deadline" saved={saved.deadline}>{text("deadline", "date")}</Field>
            <Field label="PO Date" saved={saved.po_date}>{text("po_date", "date")}</Field>
            <Field label="Invoice Date" saved={saved.invoice_date}>{text("invoice_date", "date")}</Field>
            <Field label="Payment Terms" saved={saved.payment_terms}>
              <select className="pd-input" value={project.payment_terms ?? ""} onChange={(e) => save({ payment_terms: e.target.value || null }, "payment_terms")}>
                <option value="">—</option>
                {PAYMENT_TERMS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Payment Due Date" saved={saved.payment_due_date}>{text("payment_due_date", "date")}</Field>
            <Field label="Payment Status" saved={saved.payment_status}>{select("payment_status", PAYMENT_STATUSES, "Unpaid")}</Field>
            <Field label="Stage" saved={saved.stage}>
              <select className="pd-input" value={stage} onChange={(e) => saveStage(e.target.value)}>
                {PROJECT_STAGES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="pd-card">
          <div className="pd-label">NOTES {saved.notes && <b className="pd-check">✓</b>}</div>
          <textarea
            className="pd-input pd-notes"
            placeholder="Add project notes, context, or reminders..."
            value={project.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
            onBlur={() => save({ notes: project.notes || null }, "notes")}
          />
        </div>

        <div className="pd-card">
          <div className="pd-label">TIMELINE</div>
          <div className="pd-timeline-scroll">
            <div className="pd-timeline">
              {points.map(([label, date], i) => {
                const state = dotState(date);
                return (
                  <div key={label} className="pd-tl-step">
                    <div className="pd-tl-track">
                      <span className={`pd-tl-line${i === 0 ? " hide" : ""}`} />
                      <span className={`pd-tl-dot ${state}`} />
                      <span className={`pd-tl-line${i === points.length - 1 ? " hide" : ""}`} />
                    </div>
                    <div className="pd-tl-label">{label}</div>
                    <div className="pd-tl-date">{date ? fmtDay(date) : "TBD"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="pd-col">
        <div className="pd-card">
          <div className="pd-label">P&amp;L SUMMARY</div>

          <div className="pd-sublabel">REVENUE</div>
          <div className="pd-pl-row">
            <span className="pd-pl-name">Invoice Amount <Pill fg="#475569" bg="#f1f5f9">{vatType}</Pill></span>
            <PlInput project={project} field="invoice_amount" set={set} onSave={saveNumber} saved={saved.invoice_amount} />
          </div>

          <div className="pd-sublabel pd-sublabel-costs">COSTS</div>
          <div className="pd-pl-row">
            <span className="pd-pl-name"><i className="pd-minus" />COGS</span>
            <PlInput project={project} field="cogs" set={set} onSave={saveNumber} saved={saved.cogs} />
          </div>
          <div className="pd-pl-row">
            <span className="pd-pl-name"><i className="pd-minus" />Shipping Cost</span>
            <PlInput project={project} field="shipping_cost" set={set} onSave={saveNumber} saved={saved.shipping_cost} />
          </div>
          <div className="pd-pl-row">
            <span className="pd-pl-name"><i className="pd-minus" />Project Expenses</span>
            <span className="pd-pl-ro">{money(expenseTotal)}</span>
          </div>

          <hr className="pd-hr" />
          <div className="pd-pl-row">
            <b>GROSS PROFIT</b>
            <span className="pd-profit" style={{ color: profit >= 0 ? "#16a34a" : "#dc2626" }}>{money(profit)}</span>
          </div>
          <div className="pd-margin">
            Gross Margin {margin == null ? "—" : `${margin.toFixed(1)}%`}
          </div>
        </div>

        <InsightPanel project={project} invoice={invoice} profit={profit} margin={margin} rfqCount={rfqs.length} quoteCount={quotes.length} />

        <div className="pd-card pd-counts">
          <span>{missionCount} mission{missionCount === 1 ? "" : "s"}</span>
          <span>{taskCount} task{taskCount === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

function PlInput({ project, field, set, onSave, saved }) {
  return (
    <span className="pd-pl-input">
      {saved && <b className="pd-check">✓</b>}
      <input
        className="pd-input pd-num"
        type="number"
        min="0"
        step="0.01"
        value={project[field] ?? 0}
        onChange={(e) => set({ [field]: e.target.value })}
        onBlur={() => onSave(field)}
      />
    </span>
  );
}

function InsightPanel({ project, invoice, profit, margin, rfqCount, quoteCount }) {
  const [state, setState] = useState(() => insightCache.get(project.id) ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const generate = async () => {
    const cached = insightCache.get(project.id);
    if (cached && Date.now() - cached.at < INSIGHT_TTL_MS) {
      setState(cached);
      return;
    }
    setLoading(true);
    setErr(null);
    const idle = daysSince(project.updated_at);
    const data = [
      `Project: ${project.name}`,
      `Client: ${project.client_name || "unassigned"}`,
      `Stage: ${project.stage || "Open"}`,
      `Invoice amount: PHP ${invoice.toFixed(2)}`,
      `Gross profit: PHP ${profit.toFixed(2)}`,
      `Gross margin: ${margin == null ? "n/a" : `${margin.toFixed(1)}%`}`,
      `Deadline: ${project.deadline || "not set"}`,
      `Days since last activity: ${idle ?? "unknown"}`,
      `Linked RFQs: ${rfqCount}`,
      `Quotations: ${quoteCount}`,
    ].join("\n");
    try {
      const { data: res, error } = await supabase.functions.invoke("parse-rfq", { body: { mode: "project_insight", data } });
      if (error) throw new Error(error.message);
      if (res?.error) throw new Error(res.error);
      const next = { text: res.insight, at: Date.now() };
      insightCache.set(project.id, next);
      setState(next);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pd-insight">
      <button className="pd-ai-btn" onClick={generate} disabled={loading}>
        {loading ? <span className="pd-spin" /> : null}
        {loading ? "Generating…" : "Generate AI Project Insight"}
      </button>
      {err && <div className="pd-error">{err}</div>}
      {state && !loading && <div className="pd-insight-card">{state.text}</div>}
    </div>
  );
}

// ============================ Tab 2: RFQs and POs ================================

function PoForm({ projectId, onDone, setError }) {
  const [f, setF] = useState({ po_number: "", total_amount: "", order_date: todayISO(), expected_delivery_date: "" });
  const submit = async () => {
    if (!f.po_number.trim()) return setError("A PO needs a PO number.");
    const { error } = await supabase.from("purchase_orders").insert({
      project_id: projectId,
      po_number: f.po_number.trim(),
      total_amount: Number(f.total_amount) || 0,
      order_date: f.order_date || null,
      expected_delivery_date: f.expected_delivery_date || null,
      status: "open",
    });
    if (error) return setError(`Couldn't create PO: ${error.message}`);
    onDone(true);
  };
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="pd-picker">
      <input className="pd-input" placeholder="PO number" value={f.po_number} onChange={on("po_number")} />
      <input className="pd-input" type="number" min="0" step="0.01" placeholder="Total (PHP)" value={f.total_amount} onChange={on("total_amount")} />
      <input className="pd-input" type="date" title="Order date" value={f.order_date} onChange={on("order_date")} />
      <input className="pd-input" type="date" title="Expected delivery" value={f.expected_delivery_date} onChange={on("expected_delivery_date")} />
      <button className="pd-btn pd-btn-blue pd-sm" onClick={submit}>Create</button>
      <button className="pd-link" onClick={() => onDone(false)}>Cancel</button>
    </div>
  );
}

function LinkedTab({ projectId, rfqs, pos, reload, setError, navigate, newPo, setNewPo }) {
  const [picker, setPicker] = useState(null); // "rfq" | "po"
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);

  const openPicker = async (kind) => {
    setPicker(kind);
    setQuery("");
    const { data, error } =
      kind === "rfq"
        ? await supabase.from("rfqs").select("id, rfq_number, title, received_date, project_id").order("received_date", { ascending: false, nullsFirst: false }).limit(200)
        : await supabase.from("purchase_orders").select("id, po_number, order_date, project_id").order("order_date", { ascending: false, nullsFirst: false }).limit(200);
    if (error) return setError(error.message);
    setOptions(
      (data ?? [])
        .filter((r) => r.project_id !== projectId)
        .map((r) => ({
          id: r.id,
          label: kind === "rfq" ? `${r.rfq_number ? `${r.rfq_number} · ` : ""}${r.title}` : r.po_number || r.id.slice(0, 8),
          sub: kind === "rfq" ? r.received_date : r.order_date,
        }))
    );
  };

  const link = async (kind, option) => {
    const { error } = await supabase.from(kind === "rfq" ? "rfqs" : "purchase_orders").update({ project_id: projectId }).eq("id", option.id);
    if (error) setError(`Couldn't link: ${error.message}`);
    setPicker(null);
    reload();
  };
  const unlink = async (kind, rowId) => {
    const { error } = await supabase.from(kind === "rfq" ? "rfqs" : "purchase_orders").update({ project_id: null }).eq("id", rowId);
    if (error) setError(`Couldn't unlink: ${error.message}`);
    reload();
  };

  const picked = (kind) =>
    picker === kind && (
      <div className="pd-picker">
        <Combobox value={query} onChange={setQuery} onPick={(o) => link(kind, o)} options={options} placeholder={`Search ${kind === "rfq" ? "RFQs" : "POs"}…`} />
        <button className="pd-link" onClick={() => setPicker(null)}>Cancel</button>
      </div>
    );

  return (
    <div className="pd-stack">
      <div className="pd-card">
        <div className="pd-section-head">
          <h3>RFQs</h3>
          <button className="pd-btn pd-btn-outline pd-sm" onClick={() => openPicker("rfq")}>Link Existing RFQ</button>
        </div>
        {picked("rfq")}
        {rfqs.length === 0 ? (
          <div className="pd-empty">
            <p>No RFQs linked to this project.</p>
            <button className="pd-btn pd-btn-blue" onClick={() => navigate(`/intake?project_id=${projectId}`)}>New RFQ</button>
          </div>
        ) : (
          rfqs.map((r) => (
            <div key={r.id} className="pd-row">
              <b>{r.rfq_number || "—"}</b>
              <span className="pd-trunc">{r.title}</span>
              <StatusBadge status={r.status} />
              <span className="pd-muted">Closes {fmtDate(r.closing_date)}</span>
              <span className="pd-row-actions">
                <button className="pd-link" onClick={() => unlink("rfq", r.id)}>Unlink</button>
                {/* Intake only creates RFQs; existing ones are worked in the Sourcing Desk. */}
                <button className="pd-btn pd-btn-outline pd-sm" onClick={() => navigate(`/sourcing?rfq=${r.id}`)}>Open</button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="pd-card">
        <div className="pd-section-head">
          <h3>Purchase Orders</h3>
          <button className="pd-btn pd-btn-outline pd-sm" onClick={() => openPicker("po")}>Link Existing PO</button>
        </div>
        {picked("po")}
        {newPo && <PoForm projectId={projectId} setError={setError} onDone={(created) => { setNewPo(false); if (created) reload(); }} />}
        {pos.length === 0 ? (
          <div className="pd-empty">
            <p>No purchase orders linked to this project.</p>
            <button className="pd-btn pd-btn-outline" onClick={() => setNewPo(true)}>New Supplier PO</button>
          </div>
        ) : (
          pos.map((p) => (
            <div key={p.id} className="pd-row">
              <b>{p.po_number || "—"}</b>
              <span className="pd-trunc">{money(p.total_amount)}</span>
              <span className="pd-muted">Ordered {fmtDate(p.order_date)}</span>
              <StatusBadge status={p.status} />
              <span className="pd-muted">Delivery {fmtDate(p.expected_delivery_date)}</span>
              <span className="pd-row-actions">
                <button className="pd-link" onClick={() => unlink("po", p.id)}>Unlink</button>
                <button className="pd-btn pd-btn-outline pd-sm" onClick={() => navigate("/ledger")}>Open</button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================ Tab 3: Quotations ==================================

function QuotationsTab({ quotes, projectId, navigate, setError }) {
  const [busyId, setBusyId] = useState(null);

  const viewPdf = async (q) => {
    setBusyId(q.id);
    // Open the tab synchronously so the popup blocker allows it, then point it at the PDF.
    const win = window.open("", "_blank");
    try {
      const { pdfUrl } = await renderQuotationPdf({
        rfq: { id: q.rfq_id, clientName: q.rfqs?.clients?.name, clientAddress: q.rfqs?.clients?.address, closing_date: q.rfqs?.closing_date },
        contact: null,
        lineItems: q.line_items ?? [],
        totals: { subtotal: q.subtotal ?? 0, vat: q.vat_amount ?? 0, grandTotal: q.total_amount ?? 0 },
        quoteNumber: q.quote_number,
      });
      if (win) win.location.href = pdfUrl;
      else window.open(pdfUrl, "_blank");
    } catch (e) {
      win?.close();
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pd-card">
      <div className="pd-section-head">
        <h3>Quotations</h3>
        <button className="pd-btn pd-btn-purple pd-sm" onClick={() => navigate(`/quote-builder?project_id=${projectId}`)}>Generate New Quotation</button>
      </div>
      {quotes.length === 0 ? (
        <div className="pd-empty">
          <p>No quotations yet. Quotations appear here once one is sent for an RFQ linked to this project.</p>
          <button className="pd-btn pd-btn-purple" onClick={() => navigate(`/quote-builder?project_id=${projectId}`)}>Generate Quotation</button>
        </div>
      ) : (
        quotes.map((q) => {
          const m = q.blended_margin_percent;
          const tone = m == null ? null : { green: { fg: "#15803d", bg: "#dcfce7" }, amber: { fg: "#b45309", bg: "#fef3c7" }, red: { fg: "#b91c1c", bg: "#fee2e2" } }[marginTone(Number(m))];
          return (
            <div key={q.id} className="pd-row">
              <b>{q.quote_number || "—"}</b>
              <span className="pd-muted">Subtotal {money(q.subtotal)}</span>
              <span className="pd-muted">VAT {money(q.vat_amount)}</span>
              <b>{money(q.total_amount)}</b>
              {tone && <Pill {...tone}>{Number(m).toFixed(1)}%</Pill>}
              <StatusBadge status={q.status} />
              <span className="pd-muted">{fmtDate(q.sent_date)}</span>
              <span className="pd-row-actions">
                <button className="pd-btn pd-btn-outline pd-sm" disabled={busyId === q.id} onClick={() => viewPdf(q)}>
                  {busyId === q.id ? "Rendering…" : "View PDF"}
                </button>
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================ Tab 4: Sourcing ====================================

function SourcingTab({ sessions, projectId, navigate }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="pd-card">
      <div className="pd-section-head">
        <h3>Sourcing</h3>
        <button className="pd-btn pd-btn-amber pd-sm" onClick={() => navigate(`/sourcing?project_id=${projectId}`)}>Source Items</button>
      </div>
      {sessions.length === 0 ? (
        <div className="pd-empty">
          <p>No sourcing yet. Link an RFQ to this project, then source its items.</p>
          <button className="pd-btn pd-btn-amber" onClick={() => navigate(`/sourcing?project_id=${projectId}`)}>Source Items</button>
        </div>
      ) : (
        sessions.map((s) => {
          const subject = `${s.rfq.rfq_number ? `${s.rfq.rfq_number} · ` : ""}${s.rfq.title}`;
          return (
            <div key={s.rfq.id} className="pd-session">
              <div className="pd-row">
                <span className="pd-muted">{fmtDate(s.started ?? s.rfq.received_date)}</span>
                <span className="pd-trunc">{subject.length > 60 ? `${subject.slice(0, 57)}…` : subject}</span>
                <span className="pd-muted">{s.supplierCount} supplier{s.supplierCount === 1 ? "" : "s"} · {s.quoteCount} quote{s.quoteCount === 1 ? "" : "s"}</span>
                <span className="pd-row-actions">
                  <button className="pd-btn pd-btn-outline pd-sm" onClick={() => setOpenId(openId === s.rfq.id ? null : s.rfq.id)}>
                    {openId === s.rfq.id ? "Hide" : "View"}
                  </button>
                </span>
              </div>
              {openId === s.rfq.id && (
                <div className="pd-session-body">
                  {s.lines.length === 0 && <div className="pd-muted">No line items on this RFQ.</div>}
                  {s.lines.map((l) => (
                    <div key={l.id} className="pd-line">
                      <div className="pd-line-head">
                        <b>{l.line_number ?? "·"}. {l.description}</b>
                        <span className="pd-muted">Qty {l.quantity} {l.unit}</span>
                        <StatusBadge status={l.status} />
                      </div>
                      {(l.supplier_quotes ?? []).length === 0 ? (
                        <div className="pd-muted">No supplier quotes yet.</div>
                      ) : (
                        (l.supplier_quotes ?? []).map((sq) => (
                          <div key={sq.id} className="pd-sq">
                            <span>{sq.suppliers?.name ?? "Supplier"}{sq.brand ? ` · ${sq.brand}` : ""}</span>
                            <span>{sq.unit_price != null ? `$${Number(sq.unit_price).toFixed(2)}` : "—"}</span>
                            <span className="pd-muted">{sq.lead_time_days != null ? `${sq.lead_time_days}d lead` : ""}</span>
                            <StatusBadge status={sq.status} />
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================ Tab 5: Expenses ====================================

const blankExpense = () => ({ date: todayISO(), type: "Project Expense", category: "", description: "", amount: "", vat_applicable: false });

function ExpensesTab({ projectId, expenses, reload, setError }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blankExpense());
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(null);
  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category).filter(Boolean))].sort(), [expenses]);

  const vatOf = (amount, on) => (on ? Math.round(Number(amount || 0) * VAT_RATE * 100) / 100 : 0);

  const insert = async () => {
    if (!draft.description.trim()) return setError("An expense needs a description.");
    const { error } = await supabase.from("project_expenses").insert({
      project_id: projectId,
      date: draft.date || todayISO(),
      type: draft.type,
      category: draft.category.trim() || null,
      description: draft.description.trim(),
      amount: Number(draft.amount) || 0,
      vat_applicable: draft.vat_applicable,
      vat_amount: vatOf(draft.amount, draft.vat_applicable),
    });
    if (error) return setError(`Couldn't add expense: ${error.message}`);
    setDraft(blankExpense());
    setAdding(false);
    reload();
  };

  const startEdit = (row) => {
    setEditId(row.id);
    setEdit({ ...row, amount: row.amount });
  };
  const commitEdit = async () => {
    if (!edit || !edit.description?.trim()) {
      setEditId(null);
      return;
    }
    const { error } = await supabase
      .from("project_expenses")
      .update({
        date: edit.date,
        type: edit.type,
        category: edit.category || null,
        description: edit.description.trim(),
        amount: Number(edit.amount) || 0,
        vat_applicable: edit.vat_applicable,
        vat_amount: vatOf(edit.amount, edit.vat_applicable),
      })
      .eq("id", editId);
    if (error) setError(`Couldn't save: ${error.message}`);
    setEditId(null);
    reload();
  };
  const remove = async (row) => {
    const { error } = await supabase.from("project_expenses").delete().eq("id", row.id);
    if (error) setError(`Couldn't delete: ${error.message}`);
    reload();
  };

  const totals = EXPENSE_TYPES.map((t) => [t, expenses.filter((e) => e.type === t).reduce((s, e) => s + Number(e.amount ?? 0), 0)]);
  const grand = totals.reduce((s, [, v]) => s + v, 0);

  const typeSelect = (v, onChange) => (
    <select className="pd-input" value={v} onChange={(e) => onChange(e.target.value)}>
      {EXPENSE_TYPES.map((t) => (
        <option key={t}>{t}</option>
      ))}
    </select>
  );

  return (
    <div className="pd-card">
      <div className="pd-section-head">
        <h3>Expenses</h3>
        <button className="pd-btn pd-btn-blue pd-sm" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Add Expense"}</button>
      </div>
      <datalist id="pd-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="pd-table-wrap">
        <table className="pd-table">
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Category</th><th>Description</th><th className="r">Amount</th><th>VAT</th><th className="r">VAT Amount</th><th className="r">Net Amount</th><th />
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="pd-add-row">
                <td><input className="pd-input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></td>
                <td>{typeSelect(draft.type, (type) => setDraft({ ...draft, type }))}</td>
                <td><input className="pd-input" list="pd-categories" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Category" /></td>
                <td><input className="pd-input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description" /></td>
                <td><input className="pd-input pd-num" type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></td>
                <td><input type="checkbox" checked={draft.vat_applicable} onChange={(e) => setDraft({ ...draft, vat_applicable: e.target.checked })} /></td>
                <td className="r">{money(vatOf(draft.amount, draft.vat_applicable))}</td>
                <td className="r">{money(Number(draft.amount || 0) + vatOf(draft.amount, draft.vat_applicable))}</td>
                <td><button className="pd-btn pd-btn-blue pd-sm" onClick={insert}>Save</button></td>
              </tr>
            )}
            {expenses.map((row) =>
              editId === row.id ? (
                <tr key={row.id} className="pd-add-row">
                  <td><input className="pd-input" type="date" value={edit.date ?? ""} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></td>
                  <td>{typeSelect(edit.type, (type) => setEdit({ ...edit, type }))}</td>
                  <td><input className="pd-input" list="pd-categories" value={edit.category ?? ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></td>
                  <td><input className="pd-input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></td>
                  <td><input className="pd-input pd-num" type="number" min="0" step="0.01" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></td>
                  <td><input type="checkbox" checked={!!edit.vat_applicable} onChange={(e) => setEdit({ ...edit, vat_applicable: e.target.checked })} /></td>
                  <td className="r">{money(vatOf(edit.amount, edit.vat_applicable))}</td>
                  <td className="r">{money(Number(edit.amount || 0) + vatOf(edit.amount, edit.vat_applicable))}</td>
                  <td className="pd-nowrap">
                    <button className="pd-btn pd-btn-blue pd-sm" onClick={commitEdit}>Save</button>{" "}
                    <button className="pd-link" onClick={() => setEditId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="pd-click" onClick={() => startEdit(row)}>
                  <td>{fmtDate(row.date)}</td>
                  <td><Pill {...EXPENSE_COLORS[row.type]}>{row.type}</Pill></td>
                  <td>{row.category || "—"}</td>
                  <td>{row.description}</td>
                  <td className="r">{money(row.amount)}</td>
                  <td><input type="checkbox" checked={!!row.vat_applicable} readOnly /></td>
                  <td className="r">{money(row.vat_amount)}</td>
                  <td className="r">{money(row.net_amount)}</td>
                  <td>
                    <button
                      className="pd-del"
                      title="Delete expense"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(row);
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            )}
            {expenses.length === 0 && !adding && (
              <tr><td colSpan={9} className="pd-empty-cell">No expenses recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pd-totals">
        {totals.map(([t, v]) => (
          <span key={t}>{t}: <b>{money(v)}</b></span>
        ))}
        <span className="pd-grand">Grand Total: <b>{money(grand)}</b></span>
      </div>
    </div>
  );
}

// ============================ Tab 6: Documents ===================================

function DocumentsTab({ projectId, docs, reload, setError }) {
  const [over, setOver] = useState(false);
  const [uploads, setUploads] = useState([]); // [{ name, pct }]
  const inputRef = useRef(null);

  const upload = async (files) => {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name} is over the 20MB limit.`);
        continue;
      }
      if (!(file.type === "application/pdf" || file.type.startsWith("image/"))) {
        setError(`${file.name}: only PDFs and images are supported.`);
        continue;
      }
      setUploads((u) => [...u, { name: file.name, pct: 10 }]);
      // Storage keys must be URL-safe; the original name is kept in project_documents.file_name.
      const path = `${projectId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      // supabase-js exposes no upload progress, so show an indeterminate-ish bar that completes on resolve.
      const tick = setInterval(() => setUploads((u) => u.map((x) => (x.name === file.name && x.pct < 85 ? { ...x, pct: x.pct + 5 } : x))), 250);
      const { error: upErr } = await supabase.storage.from("project-documents").upload(path, file, { contentType: file.type });
      clearInterval(tick);
      if (upErr) {
        setError(`Upload failed for ${file.name}: ${upErr.message}`);
      } else {
        const { error: dbErr } = await supabase.from("project_documents").insert({
          project_id: projectId,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
        });
        if (dbErr) {
          await supabase.storage.from("project-documents").remove([path]);
          setError(`Couldn't record ${file.name}: ${dbErr.message}`);
        }
      }
      setUploads((u) => u.filter((x) => x.name !== file.name));
    }
    reload();
  };

  const download = async (doc) => {
    const { data, error } = await supabase.storage.from("project-documents").createSignedUrl(doc.file_path, 60, { download: doc.file_name });
    if (error) return setError(`Couldn't download: ${error.message}`);
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = doc.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const remove = async (doc) => {
    if (!window.confirm(`Delete ${doc.file_name}? This can't be undone.`)) return;
    const { error: stErr } = await supabase.storage.from("project-documents").remove([doc.file_path]);
    if (stErr) return setError(`Couldn't delete the file: ${stErr.message}`);
    const { error } = await supabase.from("project_documents").delete().eq("id", doc.id);
    if (error) setError(`Couldn't delete the record: ${error.message}`);
    reload();
  };

  return (
    <div className="pd-stack">
      <div
        className={`pd-drop${over ? " over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload([...e.dataTransfer.files]);
        }}
      >
        <CloudUpload />
        <div className="pd-drop-t">Drop files here or click to upload</div>
        <div className="pd-muted">PDF, images up to 20MB</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => {
            upload([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>
      {uploads.map((u) => (
        <div key={u.name} className="pd-progress">
          <span className="pd-trunc">{u.name}</span>
          <div className="pd-bar"><i style={{ width: `${u.pct}%` }} /></div>
        </div>
      ))}
      <div className="pd-doc-grid">
        {docs.map((d) => {
          const isPdf = d.file_type === "application/pdf";
          return (
            <div key={d.id} className="pd-doc">
              <div className="pd-doc-name" title={d.file_name}>{d.file_name}</div>
              <div className="pd-doc-meta">
                <Pill {...(isPdf ? { fg: "#b91c1c", bg: "#fee2e2" } : { fg: "#1d4ed8", bg: "#dbeafe" })}>{isPdf ? "PDF" : "Image"}</Pill>
                <span>{fmtSize(d.file_size)}</span>
                <span>{fmtDate(d.uploaded_at)}</span>
              </div>
              <div className="pd-doc-actions">
                <button className="pd-btn pd-btn-outline pd-sm" onClick={() => download(d)}>Download</button>
                <button className="pd-btn pd-btn-danger pd-sm" onClick={() => remove(d)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      {docs.length === 0 && uploads.length === 0 && <div className="pd-muted pd-center">No documents uploaded yet.</div>}
    </div>
  );
}
