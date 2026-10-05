import { useEffect, useRef, useState } from "react";
import "./TaskPanel.css";
import { DEFAULT_TASK_FIELDS, PRIORITY_DOT, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "../lib/taskFields";

// Task properties slide-over, shared by Home and Planning.
//
// hierarchy: { areas: string[], projectsFor(area): string[],
//              missionsFor(project): string[],
//              create(type: "project"|"mission", name, { area, project }) }
// Styles live in TaskPanel.css and carry their own colour variables, so the
// panel looks the same inside or outside the homepage's stylesheet.

/**
 * Dropdown listing existing records, with an optional inline "+ Create new"
 * row. Closes on an outside click.
 */
function SmartSelect({ value, options, onChange, placeholder = "None", allowNone = false, createLabel, onCreate }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (v) => {
    onChange(v);
    setOpen(false);
    setCreating(false);
  };
  const create = async () => {
    const name = draft.trim();
    if (!name) return;
    await onCreate(name);
    setDraft("");
    choose(name);
  };
  const list = [...new Set([value, ...options].filter(Boolean))];

  return (
    <div className="ss-wrap" ref={wrapRef}>
      <button type="button" className="tp-input ss-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={value ? "" : "ss-ph"}>{value || placeholder}</span>
        <svg className="ss-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="ss-list" role="listbox">
          {allowNone && (
            <div className={`ss-opt ss-none${!value ? " sel" : ""}`} onClick={() => choose("")}>{placeholder}</div>
          )}
          {list.map((o) => (
            <div key={o} role="option" aria-selected={o === value} className={`ss-opt${o === value ? " sel" : ""}`} onClick={() => choose(o)}>
              {o}
            </div>
          ))}
          {onCreate &&
            (creating ? (
              <div className="ss-new">
                <input
                  autoFocus
                  value={draft}
                  placeholder="Name, then Enter"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") create();
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setCreating(false);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="ss-opt ss-create" onClick={() => setCreating(true)}>+ {createLabel}</div>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * task: { uid, title, source, fields, statusOptions, priorityOptions,
 *         canDelete, deleteNote, confirmDelete }
 */
export default function TaskPanel({ open, task, hierarchy, onClose, onSave, onDelete }) {
  const panelRef = useRef(null);
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState(DEFAULT_TASK_FIELDS);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setFields({ ...DEFAULT_TASK_FIELDS, ...task.fields });
    setConfirming(false);
    setSaving(false);
  }, [task]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const setValue = (k) => (v) =>
    setFields((f) => {
      const next = { ...f, [k]: v };
      // Keep the chain consistent: a new area drops a project from another
      // area, and a new project drops a mission from another project.
      if (k === "area" && next.project && !hierarchy.projectsFor(v).includes(next.project)) next.project = "";
      if ((k === "area" || k === "project") && next.mission && !hierarchy.missionsFor(next.project).includes(next.mission)) {
        next.mission = "";
      }
      return next;
    });
  const statusOptions = task?.statusOptions ?? TASK_STATUSES;
  const priorityOptions = task?.priorityOptions ?? TASK_PRIORITIES;

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title: title.trim(), fields });
    setSaving(false);
  };
  const del = () => {
    if (task.confirmDelete && !confirming) {
      setConfirming(true);
      return;
    }
    onDelete();
  };

  return (
    <>
      <div className={`tp-overlay${open ? " open" : ""}`}></div>
      <div ref={panelRef} className={`tp-panel${open ? " open" : ""}`} role="dialog" aria-label="Task properties" aria-hidden={!open}>
        {task && (
          <>
            <div className="tp-head">
              <input
                className="tp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                aria-label="Task title"
              />
              <button className="tp-close" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className="tp-body">
              <div className="tp-src">{task.source}</div>
              <div>
                <div className="tp-sec-label">Hierarchy</div>
                <div className="tp-row">
                  <span className="tp-label">
                    <span className="tp-dot" style={{ background: PRIORITY_DOT[fields.priority] ?? "var(--t4)" }}></span>Area
                  </span>
                  <SmartSelect value={fields.area} options={hierarchy.areas} onChange={setValue("area")} placeholder="Choose area" />
                </div>
                <div className="tp-row">
                  <span className="tp-label">Project</span>
                  <SmartSelect
                    value={fields.project}
                    options={hierarchy.projectsFor(fields.area)}
                    onChange={setValue("project")}
                    allowNone
                    createLabel="Create new project"
                    onCreate={(name) => hierarchy.create("project", name, { area: fields.area })}
                  />
                </div>
                <div className="tp-row">
                  <span className="tp-label">Mission</span>
                  <SmartSelect
                    value={fields.mission}
                    options={hierarchy.missionsFor(fields.project)}
                    onChange={setValue("mission")}
                    allowNone
                    createLabel="Create new mission"
                    onCreate={(name) => hierarchy.create("mission", name, { area: fields.area, project: fields.project })}
                  />
                </div>
                <div className="tp-row">
                  <span className="tp-label">Type</span>
                  <select className="tp-input" value={fields.type} onChange={set("type")}>
                    {TASK_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="tp-sec-label">Details</div>
                <div className="tp-row">
                  <span className="tp-label">Status</span>
                  <select className="tp-input" value={fields.status} onChange={set("status")}>
                    {[...new Set([fields.status, ...statusOptions])].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="tp-row">
                  <span className="tp-label">Due date</span>
                  <input className="tp-input" type="date" value={fields.due_date} onChange={set("due_date")} />
                </div>
                <div className="tp-row">
                  <span className="tp-label">Due time</span>
                  <span className="tp-time">
                    <input
                      className="tp-input"
                      type="time"
                      value={fields.due_time ?? ""}
                      onChange={set("due_time")}
                      // Optional, but 09:00 once you start setting one.
                      onFocus={() => !fields.due_time && setFields((f) => ({ ...f, due_time: "09:00" }))}
                      aria-label="Due time"
                    />
                    {fields.due_time && (
                      <button type="button" className="tp-time-x" onClick={() => setFields((f) => ({ ...f, due_time: "" }))} aria-label="Clear due time">✕</button>
                    )}
                  </span>
                </div>
                {fields.due_time && fields.due_date && <div className="tp-hint">Saving adds a calendar event with a 30-minute alert.</div>}
                <div className="tp-row">
                  <span className="tp-label">Priority</span>
                  <select className="tp-input" value={fields.priority} onChange={set("priority")}>
                    {[...new Set([fields.priority, ...priorityOptions])].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="tp-sec-label">Notes</div>
                <textarea className="tp-notes" value={fields.notes} onChange={set("notes")} placeholder="Notes…"></textarea>
              </div>
              {task.deleteNote && <div className="tp-hint">{task.deleteNote}</div>}
            </div>
            <div className="tp-foot">
              <button className="tp-del" onClick={del} disabled={!task.canDelete}>
                {confirming ? "Click again to delete" : "Delete"}
              </button>
              <button className="tp-save" onClick={save} disabled={saving || !title.trim()}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
