// Shared by the Project detail page and the Planning Kanban cards.

export const PROJECT_STAGES = [
  "Open",
  "Sourcing",
  "Quoted",
  "Negotiation",
  "PO Received",
  "In Fulfillment",
  "Delivered",
  "Invoiced",
  "Lost",
];

// Matches the Pipeline page where a stage exists there (Sourcing purple,
// Delivered green, Lost/Declined red); the rest extend the same palette.
export const STAGE_COLORS = {
  Open: { fg: "#1d4ed8", bg: "#dbeafe" },
  Sourcing: { fg: "#6d28d9", bg: "#ede9fe" },
  Quoted: { fg: "#b45309", bg: "#fef3c7" },
  Negotiation: { fg: "#c2410c", bg: "#ffedd5" },
  "PO Received": { fg: "#047857", bg: "#d1fae5" },
  "In Fulfillment": { fg: "#0f766e", bg: "#ccfbf1" },
  Delivered: { fg: "#15803d", bg: "#dcfce7" },
  Invoiced: { fg: "#4338ca", bg: "#e0e7ff" },
  Lost: { fg: "#b91c1c", bg: "#fee2e2" },
};

export const VAT_TYPES = ["VAT Inclusive", "Zero Rated", "Exempt"];
export const VAT_RATE = 0.12;

export const stageOfProject = (p) => (PROJECT_STAGES.includes(p?.stage) ? p.stage : "Open");

export const money = (n) =>
  `₱${Number(n ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Whole days from today to a YYYY-MM-DD date (negative = overdue). */
export function daysUntil(date) {
  if (!date) return null;
  const [y, m, d] = String(date).slice(0, 10).split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export const daysSince = (ts) => (ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000) : null);

/**
 * P&L from expense rows only (project_expenses / deal_expenses). The cogs and
 * shipping_cost columns are no longer read: entering a cost there and as an
 * expense row counted it twice. Shipping Revenue rows are income, so they add
 * to revenue rather than being subtracted with the costs.
 */
export function expenseTotals(rows = []) {
  const sum = (types) => rows.filter((r) => types.includes(r.type)).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const cogs = sum(["COGS"]);
  const shipping = sum(["Shipping Cost"]);
  const other = sum(["Project Expense", "OpEx"]);
  return { cogs, shipping, other, shippingRevenue: sum(["Shipping Revenue"]), costs: cogs + shipping + other };
}

/** Gross profit = invoice amount (+ shipping revenue) − every cost row in the Expenses tab. */
export function projectPnl(invoiceAmount, rows = []) {
  const t = expenseTotals(rows);
  const invoice = Number(invoiceAmount ?? 0);
  const profit = invoice + t.shippingRevenue - t.costs;
  return { ...t, invoice, profit, margin: invoice > 0 ? (profit / invoice) * 100 : null };
}

export const marginTone = (margin) => (margin > 20 ? "green" : margin >= 10 ? "amber" : "red");

/**
 * green: active and deadline > 7 days away; amber: deadline within 7 days or
 * no activity in 14 days; red: overdue, Lost, or stage unchanged for 30+ days.
 */
export function healthOf(project) {
  const stage = stageOfProject(project);
  const left = daysUntil(project?.deadline);
  const idle = daysSince(project?.updated_at);
  const stageAge = daysSince(project?.stage_changed_at);
  const closed = stage === "Delivered" || stage === "Invoiced";
  if (stage === "Lost" || (left != null && left < 0 && !closed) || (!closed && stageAge != null && stageAge > 30)) return "red";
  if ((left != null && left <= 7 && !closed) || (idle != null && idle > 14 && !closed)) return "amber";
  return "green";
}
