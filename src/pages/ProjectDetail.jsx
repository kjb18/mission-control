import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ProjectDetail.css";
import { supabase } from "../lib/supabaseClient";
import {
  Pill,
  StatusBadge,
  Combobox,
  Field,
  PlInput,
  InsightPanel,
  QuotationsTab,
  ExpensesTab,
  DocumentsTab,
  ArrowLeft,
  fmtDay,
  fmtDate,
} from "../components/detail/shared";
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
} from "../lib/projects";

const TABS = ["Overview", "RFQs and POs", "Quotations", "Sourcing", "Expenses", "Documents"];
const PAYMENT_TERMS = ["30 Days", "60 Days", "COD", "Upon Delivery", "50% DP / 50% Balance"];
const PAYMENT_STATUSES = ["Unpaid", "Paid", "Overdue"];


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
      {tab === "Quotations" && <QuotationsTab quotes={quotes} generateHref={`/quote-builder?project_id=${id}`} navigate={navigate} setError={setError} />}
      {tab === "Sourcing" && <SourcingTab sessions={sourcing} projectId={id} navigate={navigate} />}
      {tab === "Expenses" && <ExpensesTab ownerId={id} expenses={expenses} reload={loadLinked} setError={setError} />}
      {tab === "Documents" && <DocumentsTab ownerId={id} docs={docs} reload={loadLinked} setError={setError} />}
    </div>
  );
}

// ============================ Tab 1: Overview ====================================


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

        <InsightPanel
          cacheKey={project.id}
          buildData={() =>
            [
              `Project: ${project.name}`,
              `Client: ${project.client_name || "unassigned"}`,
              `Stage: ${project.stage || "Open"}`,
              `Invoice amount: PHP ${invoice.toFixed(2)}`,
              `Gross profit: PHP ${profit.toFixed(2)}`,
              `Gross margin: ${margin == null ? "n/a" : `${margin.toFixed(1)}%`}`,
              `Deadline: ${project.deadline || "not set"}`,
              `Days since last activity: ${daysSince(project.updated_at) ?? "unknown"}`,
              `Linked RFQs: ${rfqs.length}`,
              `Quotations: ${quotes.length}`,
            ].join("\n")
          }
        />

        <div className="pd-card pd-counts">
          <span>{missionCount} mission{missionCount === 1 ? "" : "s"}</span>
          <span>{taskCount} task{taskCount === 1 ? "" : "s"}</span>
        </div>
      </div>
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
