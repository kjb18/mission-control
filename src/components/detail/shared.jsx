import { useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { renderQuotationPdf } from "../../lib/renderQuotation";
import { VAT_RATE, money, todayISO, marginTone } from "../../lib/projects";

// Pieces shared by the Project and Deal detail pages (styles: ProjectDetail.css, pd-*).

export const EXPENSE_TYPES = ["COGS", "Shipping Cost", "Shipping Revenue", "Project Expense", "OpEx"];
export const EXPENSE_COLORS = {
  COGS: { fg: "#b91c1c", bg: "#fee2e2" },
  "Shipping Cost": { fg: "#b45309", bg: "#fef3c7" },
  "Shipping Revenue": { fg: "#15803d", bg: "#dcfce7" },
  "Project Expense": { fg: "#1d4ed8", bg: "#dbeafe" },
  OpEx: { fg: "#6d28d9", bg: "#ede9fe" },
};
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000;
// Insights are cached per project for the life of the tab, so leaving the page and coming back doesn't regenerate.
export const insightCache = new Map();

export const fmtDay = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit" }) : null;
export const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");
export const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((b ?? 0) / 1024))} KB`);

export const ArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
export const CloudUpload = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 16l-4-4-4 4M12 12v9" />
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
  </svg>
);

export function Pill({ children, fg, bg, className = "" }) {
  return (
    <span className={`pd-pill ${className}`} style={{ color: fg, background: bg }}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
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
export function Combobox({ value, onChange, onPick, onBlurText, options, placeholder }) {
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

export function Field({ label, saved, children }) {
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

export function PlInput({ project, field, set, onSave, saved }) {
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

export function InsightPanel({ cacheKey, buildData }) {
  const [state, setState] = useState(() => insightCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const generate = async () => {
    const cached = insightCache.get(cacheKey);
    if (cached && Date.now() - cached.at < INSIGHT_TTL_MS) {
      setState(cached);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("parse-rfq", { body: { mode: "project_insight", data: buildData() } });
      if (error) throw new Error(error.message);
      if (res?.error) throw new Error(res.error);
      const next = { text: res.insight, at: Date.now() };
      insightCache.set(cacheKey, next);
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

export function QuotationsTab({ quotes, generateHref, navigate, setError }) {
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
        <button className="pd-btn pd-btn-purple pd-sm" onClick={() => navigate(generateHref)}>Generate New Quotation</button>
      </div>
      {quotes.length === 0 ? (
        <div className="pd-empty">
          <p>No quotations yet. Quotations appear here once one is sent for an RFQ linked to this project.</p>
          <button className="pd-btn pd-btn-purple" onClick={() => navigate(generateHref)}>Generate Quotation</button>
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

export const blankExpense = () => ({ date: todayISO(), type: "Project Expense", category: "", description: "", amount: "", vat_applicable: false });

export function ExpensesTab({ table = "project_expenses", ownerCol = "project_id", ownerId, expenses, reload, setError }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blankExpense());
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(null);
  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category).filter(Boolean))].sort(), [expenses]);

  const vatOf = (amount, on) => (on ? Math.round(Number(amount || 0) * VAT_RATE * 100) / 100 : 0);

  const insert = async () => {
    if (!draft.description.trim()) return setError("An expense needs a description.");
    const { error } = await supabase.from(table).insert({
      [ownerCol]: ownerId,
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
      .from(table)
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
    const { error } = await supabase.from(table).delete().eq("id", row.id);
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

export function DocumentsTab({ table = "project_documents", bucket = "project-documents", ownerCol = "project_id", ownerId, docs, reload, setError }) {
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
      // Storage keys must be URL-safe; the original name is kept in the documents table file_name.
      const path = `${ownerId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      // supabase-js exposes no upload progress, so show an indeterminate-ish bar that completes on resolve.
      const tick = setInterval(() => setUploads((u) => u.map((x) => (x.name === file.name && x.pct < 85 ? { ...x, pct: x.pct + 5 } : x))), 250);
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
      clearInterval(tick);
      if (upErr) {
        setError(`Upload failed for ${file.name}: ${upErr.message}`);
      } else {
        const { error: dbErr } = await supabase.from(table).insert({
          [ownerCol]: ownerId,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
        });
        if (dbErr) {
          await supabase.storage.from(bucket).remove([path]);
          setError(`Couldn't record ${file.name}: ${dbErr.message}`);
        }
      }
      setUploads((u) => u.filter((x) => x.name !== file.name));
    }
    reload();
  };

  const download = async (doc) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.file_path, 60, { download: doc.file_name });
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
    const { error: stErr } = await supabase.storage.from(bucket).remove([doc.file_path]);
    if (stErr) return setError(`Couldn't delete the file: ${stErr.message}`);
    const { error } = await supabase.from(table).delete().eq("id", doc.id);
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

