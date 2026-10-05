// Field definitions shared by the task properties panel (src/components/TaskPanel.jsx)
// and the pages that open it (Home, Planning).

export const TASK_STATUSES = ["Open", "In Progress", "Done", "Dropped"];
export const TASK_TYPES = ["Task", "Mission", "Project"];
export const TASK_PRIORITIES = ["Hot", "Medium", "Low"];
export const SEED_AREAS = ["Sales", "Sourcing", "Marketing", "Finance", "Systems", "Personal"];

export const DEFAULT_TASK_FIELDS = {
  area: "Systems",
  project: "",
  mission: "",
  type: "Task",
  status: "Open",
  due_date: "",
  due_time: "",
  priority: "Medium",
  notes: "",
};

export const PRIORITY_DOT = {
  Hot: "var(--red)",
  High: "var(--red)",
  Medium: "var(--orange)",
  Low: "var(--t4)",
  Nurturing: "var(--purple)",
};

/** Keep only the panel's own fields from a stored properties object. */
export const pickFields = (obj) =>
  Object.fromEntries(Object.keys(DEFAULT_TASK_FIELDS).filter((k) => obj?.[k] != null).map((k) => [k, obj[k]]));
