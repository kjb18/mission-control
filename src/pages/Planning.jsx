import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Planning.css";
import { supabase } from "../lib/supabaseClient";
import { useHierarchy } from "../lib/hierarchy";
import TaskPanel from "../components/TaskPanel";
import { STAGE_COLORS, stageOfProject, projectPnl, marginTone, daysUntil, healthOf } from "../lib/projects";

// Planning: areas → projects → missions → tasks (work_items), migration 0017.
// Left: hierarchy tree. Right: the selected scope's projects, missions or
// tasks as a Kanban board or a list. Rows open the shared task panel.

const COLUMNS = {
  project: [
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In Progress" },
    { key: "on_hold", label: "On Hold" },
    { key: "done", label: "Done" },
  ],
  mission: [
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In Progress" },
    { key: "on_hold", label: "On Hold" },
    { key: "done", label: "Done" },
  ],
  task: [
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In Progress" },
    { key: "done", label: "Done" },
    { key: "dropped", label: "Dropped" },
  ],
};
const LEVEL_LABEL = { project: "Projects", mission: "Missions", task: "Tasks" };
const TABLE = { project: "projects", mission: "missions", task: "work_items" };
const PRIORITY_COLOR = { Hot: "#ef4444", High: "#ef4444", Medium: "#f97316", Low: "#94a3b8" };

// projects.status defaults to "active" — treat it as Open.
const statusKey = (s) => (!s || s === "active" ? "open" : s);
const labelFor = (level, key) => COLUMNS[level].find((c) => c.key === statusKey(key))?.label ?? "Open";
const keyFor = (level, label) => COLUMNS[level].find((c) => c.label === label)?.key ?? "open";
const nameOf = (level, item) => (level === "task" ? item.title : item.name);

export default function Planning() {
  const navigate = useNavigate();
  const { areas, projects, missions, reload: reloadHierarchy, panel: hierarchy, tablesOk } = useHierarchy();
  const [tasks, setTasks] = useState([]);
  // Per-project sum of Project Expense + COGS rows, for the card's gross margin.
  const [expenseByProject, setExpenseByProject] = useState({});
  const [selection, setSelection] = useState({ type: "all", id: null });
  const [expanded, setExpanded] = useState({});
  const [level, setLevel] = useState("project");
  const [view, setView] = useState("kanban");
  const [quickAdd, setQuickAdd] = useState("");
  const [creating, setCreating] = useState(null); // { type: "area"|"project"|"mission", parentId }
  const [createName, setCreateName] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [error, setError] = useState(null);
  const [panelTask, setPanelTask] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data, error: e } = await supabase.from("work_items").select("*").order("created_at");
    if (e) setError(`Couldn't load tasks: ${e.message}`);
    else setTasks(data ?? []);
  }, []);
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);
  useEffect(() => {
    supabase
      .from("project_expenses")
      .select("project_id, type, amount")
      .in("type", ["Project Expense", "COGS"])
      .then(({ data }) => {
        const totals = {};
        for (const x of data ?? []) totals[x.project_id] = (totals[x.project_id] ?? 0) + Number(x.amount ?? 0);
        setExpenseByProject(totals);
      });
  }, [projects]);
  const reloadAll = useCallback(() => Promise.all([reloadHierarchy(), loadTasks()]), [reloadHierarchy, loadTasks]);

  const byId = (list, id) => list.find((x) => x.id === id);
  const areaOf = (item) => byId(areas, item?.area_id);
  const projectOf = (item) => byId(projects, item?.project_id);
  const missionOf = (item) => byId(missions, item?.mission_id);

  // Levels available for the current selection; the first is the default.
  const levels =
    selection.type === "mission" ? ["task"] : selection.type === "project" ? ["mission", "task"] : ["project", "mission", "task"];
  useEffect(() => {
    if (!levels.includes(level)) setLevel(levels[0]);
  }, [selection.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Everything in scope for the current selection.
  const scoped = useMemo(() => {
    const { type, id } = selection;
    const projectIn = (p) => type === "all" || (type === "area" && p.area_id === id);
    const missionIn = (m) =>
      type === "all" ||
      (type === "area" && (m.area_id === id || byId(projects, m.project_id)?.area_id === id)) ||
      (type === "project" && m.project_id === id);
    const taskIn = (t) => {
      if (type === "all") return true;
      if (type === "mission") return t.mission_id === id;
      const m = byId(missions, t.mission_id);
      if (type === "project") return t.project_id === id || m?.project_id === id;
      const p = byId(projects, t.project_id ?? m?.project_id);
      return t.area_id === id || m?.area_id === id || p?.area_id === id;
    };
    return {
      project: projects.filter(projectIn),
      mission: missions.filter(missionIn),
      task: tasks.filter(taskIn),
    };
  }, [selection, projects, missions, tasks]);

  const items = scoped[level];

  // Parent ids for a new item created in the current scope.
  const parentIds = () => {
    const { type, id } = selection;
    if (type === "mission") {
      const m = byId(missions, id);
      return { mission_id: id, project_id: m?.project_id ?? null, area_id: m?.area_id ?? byId(projects, m?.project_id)?.area_id ?? null };
    }
    if (type === "project") return { project_id: id, area_id: byId(projects, id)?.area_id ?? null };
    if (type === "area") return { area_id: id };
    return {};
  };

  const insert = async (lvl, name, parents) => {
    const row =
      lvl === "project"
        ? { name, area_id: parents.area_id ?? null, status: "open" }
        : lvl === "mission"
          ? { name, project_id: parents.project_id ?? null, area_id: parents.area_id ?? null }
          : { title: name, mission_id: parents.mission_id ?? null, project_id: parents.project_id ?? null, area_id: parents.area_id ?? null };
    const { error: e } = await supabase.from(TABLE[lvl]).insert(row);
    if (e) {
      setError(`Couldn't add ${lvl}: ${e.message}`);
      return false;
    }
    await reloadAll();
    return true;
  };

  const submitQuickAdd = async () => {
    const name = quickAdd.trim();
    if (!name) return;
    if (await insert(level, name, parentIds())) setQuickAdd("");
  };

  const submitTreeCreate = async () => {
    const name = createName.trim();
    if (!name || !creating) return;
    let ok;
    if (creating.type === "area") {
      const { error: e } = await supabase.from("areas").insert({ name });
      ok = !e;
      if (e) setError(`Couldn't add area: ${e.message}`);
      else await reloadHierarchy();
    } else if (creating.type === "project") {
      ok = await insert("project", name, { area_id: creating.parentId });
      setExpanded((x) => ({ ...x, [creating.parentId]: true }));
    } else {
      const p = byId(projects, creating.parentId);
      ok = await insert("mission", name, { project_id: creating.parentId, area_id: p?.area_id ?? null });
      setExpanded((x) => ({ ...x, [creating.parentId]: true }));
    }
    if (ok) {
      setCreating(null);
      setCreateName("");
    }
  };

  const moveTo = async (itemId, status) => {
    const table = TABLE[level];
    const setLocal = level === "task" ? setTasks : null;
    if (setLocal) setLocal((list) => list.map((x) => (x.id === itemId ? { ...x, status } : x)));
    const { error: e } = await supabase.from(table).update({ status }).eq("id", itemId);
    if (e) setError(`Couldn't move it: ${e.message}`);
    await reloadAll();
  };

  // ---- Task panel ------------------------------------------------------------
  const openPanel = (item) => {
    if (level === "project") {
      navigate(`/projects/${item.id}`);
      return;
    }
    const area = areaOf(item) ?? areaOf(projectOf(item)) ?? areaOf(missionOf(item));
    const project = projectOf(item) ?? projectOf(missionOf(item));
    setPanelTask({
      uid: `${level}:${item.id}:${Date.now()}`,
      level,
      id: item.id,
      title: nameOf(level, item),
      source: `${LEVEL_LABEL[level].slice(0, -1)} · Planning`,
      fields: {
        area: area?.name ?? "",
        project: project?.name ?? "",
        mission: missionOf(item)?.name ?? "",
        type: level === "task" ? "Task" : level === "mission" ? "Mission" : "Project",
        status: labelFor(level, item.status),
        due_date: item.due_date ?? "",
        priority: item.priority ?? "Medium",
        notes: item.notes ?? item.description ?? "",
      },
      statusOptions: COLUMNS[level].map((c) => c.label),
      canDelete: true,
      confirmDelete: true,
    });
    setPanelOpen(true);
  };
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const savePanel = async ({ title, fields }) => {
    const t = panelTask;
    const ids = { area_id: hierarchy.ids.area(fields.area), project_id: hierarchy.ids.project(fields.project), mission_id: hierarchy.ids.mission(fields.mission) };
    const common = { status: keyFor(t.level, fields.status), due_date: fields.due_date || null };
    const row =
      t.level === "project"
        ? { name: title, area_id: ids.area_id, description: fields.notes || null, ...common }
        : t.level === "mission"
          ? { name: title, area_id: ids.area_id, project_id: ids.project_id, priority: fields.priority, notes: fields.notes || null, ...common }
          : { title, ...ids, priority: fields.priority, notes: fields.notes || null, ...common };
    const { error: e } = await supabase.from(TABLE[t.level]).update(row).eq("id", t.id);
    if (e) setError(`Couldn't save: ${e.message}`);
    await reloadAll();
    closePanel();
  };

  const deleteFromPanel = async () => {
    const t = panelTask;
    const { error: e } = await supabase.from(TABLE[t.level]).delete().eq("id", t.id);
    if (e) {
      // Foreign keys: a project with missions, or a mission with tasks.
      setError(
        e.code === "23503"
          ? `This ${t.level} still has items under it — move or delete those first.`
          : `Couldn't delete: ${e.message}`
      );
    }
    await reloadAll();
    closePanel();
  };

  // ---- Rendering helpers ---------------------------------------------------------
  const countFor = (item) =>
    level === "project"
      ? missions.filter((m) => m.project_id === item.id).length
      : level === "mission"
        ? tasks.filter((t) => t.mission_id === item.id).length
        : null;

  const badgeFor = (item) => {
    if (level === "project") {
      const a = areaOf(item);
      return a ? { text: `${a.icon ?? ""} ${a.name}`.trim(), color: a.color } : null;
    }
    if (level === "mission") {
      const p = projectOf(item);
      return p ? { text: p.name, color: "#64748b" } : null;
    }
    const m = missionOf(item);
    return m ? { text: m.name, color: "#7c3aed" } : null;
  };

  const projectCard = (item, badge) => {
    const stage = stageOfProject(item);
    const sc = STAGE_COLORS[stage];
    const { margin } = projectPnl(item, expenseByProject[item.id]);
    const left = daysUntil(item.deadline);
    const health = healthOf(item);
    const missionCount = missions.filter((m) => m.project_id === item.id).length;
    const taskCount = tasks.filter((t) => t.project_id === item.id || missions.find((m) => m.id === t.mission_id)?.project_id === item.id).length;
    const deadlineTone = left < 7 ? "red" : left <= 30 ? "amber" : "gray";
    return (
      <div
        key={item.id}
        className="pl-card pl-pcard"
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
        onClick={() => navigate(`/projects/${item.id}`)}
      >
        <span className={`pl-health ${health}`} title={`Health: ${health}`} />
        <div className="pl-pname">{item.name}</div>
        {item.client_name && <div className="pl-pclient">{item.client_name}</div>}
        <div className="pl-card-meta">
          {badge && (
            <span className="pl-badge" style={{ color: badge.color, borderColor: `${badge.color}55` }}>
              {badge.text}
            </span>
          )}
          <span className="pl-stage" style={{ color: sc.fg, background: sc.bg }}>{stage}</span>
          {margin != null && <span className={`pl-margin ${marginTone(margin)}`}>{margin.toFixed(1)}%</span>}
          {left != null && (
            <span className={`pl-left ${deadlineTone}`}>
              {left < 0 ? `${-left} days overdue` : `${left} day${left === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>
        <div className="pl-card-meta">
          <span className="pl-chip">{missionCount} mission{missionCount === 1 ? "" : "s"}</span>
          <span className="pl-chip">{taskCount} task{taskCount === 1 ? "" : "s"}</span>
        </div>
      </div>
    );
  };

  const scopeTitle =
    selection.type === "all"
      ? "All areas"
      : selection.type === "area"
        ? byId(areas, selection.id)?.name
        : selection.type === "project"
          ? byId(projects, selection.id)?.name
          : byId(missions, selection.id)?.name;

  const select = (type, id) => {
    setSelection({ type, id });
    if (id) setExpanded((x) => ({ ...x, [id]: true }));
  };

  const inlineCreate = (type, parentId) =>
    creating?.type === type && creating?.parentId === parentId ? (
      <div className="pl-create">
        <input
          autoFocus
          value={createName}
          placeholder={`New ${type}…`}
          onChange={(e) => setCreateName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitTreeCreate();
            if (e.key === "Escape") setCreating(null);
          }}
          onBlur={() => !createName.trim() && setCreating(null)}
        />
      </div>
    ) : null;

  const plus = (type, parentId, title) => (
    <button
      className="pl-plus"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        setCreating({ type, parentId });
        setCreateName("");
      }}
    >
      +
    </button>
  );

  return (
    <div className="pl-page">
      <aside className="pl-tree">
        <div className="pl-tree-head">
          <span>Planning</span>
          {plus("area", null, "New area")}
        </div>
        {inlineCreate("area", null)}
        <div className={`pl-node pl-l0${selection.type === "all" ? " on" : ""}`} onClick={() => select("all", null)}>
          <span className="pl-caret" />
          <span className="pl-ico">◎</span>
          <span className="pl-name">All areas</span>
        </div>
        {areas.map((a) => (
          <div key={a.id ?? a.name}>
            <div className={`pl-node pl-l0${selection.type === "area" && selection.id === a.id ? " on" : ""}`} onClick={() => a.id && select("area", a.id)}>
              <button
                className="pl-caret"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((x) => ({ ...x, [a.id]: !x[a.id] }));
                }}
              >
                {expanded[a.id] ? "▾" : "▸"}
              </button>
              <span className="pl-ico">{a.icon ?? "□"}</span>
              <span className="pl-name">{a.name}</span>
              {a.id && plus("project", a.id, `New project in ${a.name}`)}
            </div>
            {expanded[a.id] && (
              <>
                {inlineCreate("project", a.id)}
                {projects
                  .filter((p) => p.area_id === a.id)
                  .map((p) => (
                    <div key={p.id}>
                      <div className={`pl-node pl-l1${selection.type === "project" && selection.id === p.id ? " on" : ""}`} onClick={() => select("project", p.id)}>
                        <button
                          className="pl-caret"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((x) => ({ ...x, [p.id]: !x[p.id] }));
                          }}
                        >
                          {expanded[p.id] ? "▾" : "▸"}
                        </button>
                        <span className="pl-name">{p.name}</span>
                        {plus("mission", p.id, `New mission in ${p.name}`)}
                      </div>
                      {expanded[p.id] && (
                        <>
                          {inlineCreate("mission", p.id)}
                          {missions
                            .filter((m) => m.project_id === p.id)
                            .map((m) => (
                              <div
                                key={m.id}
                                className={`pl-node pl-l2${selection.type === "mission" && selection.id === m.id ? " on" : ""}`}
                                onClick={() => select("mission", m.id)}
                              >
                                <span className="pl-dot" style={{ background: PRIORITY_COLOR[m.priority] ?? "#94a3b8" }} />
                                <span className="pl-name">{m.name}</span>
                              </div>
                            ))}
                        </>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>
        ))}
        {!tablesOk && <div className="pl-note">The planning tables aren't reachable — showing seed areas only.</div>}
      </aside>

      <section className="pl-main">
        <div className="pl-bar">
          <div className="pl-scope">
            <div className="pl-scope-title">{scopeTitle}</div>
            <div className="pl-levels">
              {levels.map((l) => (
                <button key={l} className={`pl-level${level === l ? " on" : ""}`} onClick={() => setLevel(l)}>
                  {LEVEL_LABEL[l]} <span>{scoped[l].length}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="pl-views">
            <button className={view === "kanban" ? "on" : ""} onClick={() => setView("kanban")}>Kanban</button>
            <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button>
          </div>
        </div>

        <input
          className="pl-quick"
          value={quickAdd}
          placeholder={`Add ${level}...`}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitQuickAdd()}
        />

        {error && (
          <div className="pl-error" onClick={() => setError(null)}>
            {error} <span>✕</span>
          </div>
        )}

        {view === "kanban" ? (
          <div className="pl-board">
            {COLUMNS[level].map((col) => {
              const colItems = items.filter((x) => statusKey(x.status) === col.key);
              return (
                <div
                  key={col.key}
                  className={`pl-col${dragOver === col.key ? " over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(col.key);
                  }}
                  onDragLeave={() => setDragOver((d) => (d === col.key ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) moveTo(id, col.key);
                  }}
                >
                  <div className="pl-col-head">
                    {col.label} <span>{colItems.length}</span>
                  </div>
                  {colItems.map((item) => {
                    const badge = badgeFor(item);
                    const count = countFor(item);
                    if (level === "project") return projectCard(item, badge);
                    return (
                      <div
                        key={item.id}
                        className="pl-card"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                        onClick={() => openPanel(item)}
                      >
                        <div className="pl-card-title">
                          {level !== "project" && (
                            <span className="pl-dot" style={{ background: PRIORITY_COLOR[item.priority] ?? "#94a3b8" }} />
                          )}
                          {nameOf(level, item)}
                        </div>
                        <div className="pl-card-meta">
                          {badge && (
                            <span className="pl-badge" style={{ color: badge.color, borderColor: `${badge.color}55` }}>
                              {badge.text}
                            </span>
                          )}
                          {item.due_date && <span className="pl-due">📅 {item.due_date}</span>}
                          {count != null && (
                            <span className="pl-count">
                              {count} {level === "project" ? "mission" : "task"}
                              {count === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {colItems.length === 0 && <div className="pl-empty">Drop here</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>{level === "project" ? "Area" : "Project"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onClick={() => openPanel(item)}>
                    <td className="pl-td-name">{nameOf(level, item)}</td>
                    <td>{labelFor(level, item.status)}</td>
                    <td>
                      {level === "project" ? (
                        "—"
                      ) : (
                        <>
                          <span className="pl-dot" style={{ background: PRIORITY_COLOR[item.priority] ?? "#94a3b8" }} /> {item.priority ?? "Medium"}
                        </>
                      )}
                    </td>
                    <td>{item.due_date ?? "—"}</td>
                    <td>{level === "project" ? areaOf(item)?.name ?? "—" : (projectOf(item) ?? projectOf(missionOf(item)))?.name ?? "—"}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="pl-empty">Nothing here yet — add one above.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TaskPanel
        open={panelOpen}
        task={panelTask}
        hierarchy={hierarchy}
        onClose={closePanel}
        onSave={savePanel}
        onDelete={deleteFromPanel}
      />
    </div>
  );
}
