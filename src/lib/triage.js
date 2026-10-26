import { supabase } from "./supabaseClient";
import { resolveOrCreateClient } from "./rfqIntake";

// RFQ Triage (migration 0027). Items wait in triage_queue; a deal is only
// "real" Pipeline work once it has an rfqs row, because the board reads rfqs.

export const DECLINE_REASONS = ["Outside scope", "Too small", "No supplier", "Deadline too tight", "Other"];
export const UNDO_WINDOW_MS = 10 * 60 * 1000;
// Separates Claude's reason from the decline reason appended to claude_reason.
const DECLINE_MARK = "\n\nDeclined: ";

export const VERDICTS = {
  go: { label: "GO", fg: "#047857", bg: "#f0fdf4", border: "#10b981" },
  go_with_clarification: { label: "CLARIFY", fg: "#b45309", bg: "#fffbeb", border: "#f59e0b" },
  decline: { label: "DECLINE", fg: "#b91c1c", bg: "#fef2f2", border: "#ef4444" },
};

/** Override flips the verdict display: go <-> decline; clarify becomes go. */
export const flipVerdict = (v) => (v === "go" ? "decline" : "go");

export const effectiveVerdict = (item) =>
  item.claude_verdict && item.triage_override ? flipVerdict(item.claude_verdict) : item.claude_verdict;

// ---- Manila dates -------------------------------------------------------------------
const manilaDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d); // yyyy-mm-dd

export const manilaToday = () => manilaDay(new Date());
export const isManilaToday = (iso) => Boolean(iso) && manilaDay(new Date(iso)) === manilaToday();
const manilaMidnightISO = (day = manilaToday()) => new Date(`${day}T00:00:00+08:00`).toISOString();

const fmtTime = (d) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(d);

export const formatClock = (iso) => (iso ? fmtTime(new Date(iso)) : "");

/** "5 minutes ago", "2 hours ago", "Yesterday 3:45 PM", "12 Oct 3:45 PM". */
export function timeAgo(iso, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso);
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  if (manilaDay(d) === manilaDay(now)) {
    const h = Math.floor(mins / 60);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const yesterday = manilaDay(new Date(now.getTime() - 86400000));
  if (manilaDay(d) === yesterday) return `Yesterday ${fmtTime(d)}`;
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", day: "numeric", month: "short" }).format(d);
  return `${date} ${fmtTime(d)}`;
}

/** Whole days from today (Manila) to a yyyy-mm-dd closing date; negative once past. */
export function daysUntil(closingDate) {
  if (!closingDate) return null;
  return Math.round((new Date(`${closingDate}T00:00:00Z`) - new Date(`${manilaToday()}T00:00:00Z`)) / 86400000);
}

/** items_detected entries may be strings or objects; returns a display name for each. */
export const itemName = (it) =>
  (typeof it === "string" ? it : it?.name ?? it?.description ?? it?.item ?? "").toString().trim();

// ---- Queries ------------------------------------------------------------------------

/** Pending items plus everything decided since Manila midnight (for the log and stats). */
export async function fetchTriageItems() {
  const { data, error } = await supabase
    .from("triage_queue")
    .select("*")
    .or(`status.eq.pending,processed_at.gte.${manilaMidnightISO()}`)
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function countPendingTriage() {
  const { count, error } = await supabase
    .from("triage_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function countTriagePendingDeals() {
  const { count, error } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("status", "triage_pending");
  if (error) throw error;
  return count ?? 0;
}

/** Tells the sidebar badge to refetch without waiting for its 5-minute poll. */
export const notifyTriageChanged = () => window.dispatchEvent(new Event("triage:changed"));

// ---- Mutations ----------------------------------------------------------------------

/** Manual entry: a pending queue row plus a linked triage_pending deal. */
export async function createManualRfq({ client_name, rfq_number, subject, items, closing_date, notes }) {
  const names = (items ?? "")
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .insert({
      client_name,
      rfq_number: rfq_number || null,
      title: rfq_number || subject || client_name,
      status: "triage_pending",
      stage: "triage_pending",
      received_date: manilaToday(),
      closing_date: closing_date || null,
      notes: notes || null,
      triage_source: "manual",
    })
    .select("id")
    .single();
  if (dealError) throw dealError;

  const { data, error } = await supabase
    .from("triage_queue")
    .insert({
      client_name,
      rfq_number: rfq_number || null,
      subject: subject || null,
      received_at: new Date().toISOString(),
      raw_body: [items, notes && `Notes: ${notes}`].filter(Boolean).join("\n\n") || null,
      items_detected: names.map((name) => ({ name })),
      closing_date: closing_date || null,
      status: "pending",
      triage_source: "manual",
      deal_id: deal.id,
    })
    .select()
    .single();
  if (error) {
    await supabase.from("deals").delete().eq("id", deal.id);
    throw error;
  }
  return data;
}

async function unwind(...fns) {
  for (const fn of fns) await Promise.resolve(fn()).catch(() => {});
}

/**
 * Accept: the deal becomes intake_confirmed and gets an rfqs row (with its lines),
 * which is what puts it on the Pipeline board. Rolls back what it created on failure.
 */
export async function acceptItem(item) {
  const now = new Date().toISOString();
  const received = item.received_at ? manilaDay(new Date(item.received_at)) : manilaToday();
  const triageFields = {
    triage_verdict: item.claude_verdict,
    triage_reason: item.claude_reason,
    triage_date: now,
    triage_source: item.triage_source ?? "gmail_agent",
    triage_override: Boolean(item.triage_override),
  };
  const title = item.rfq_number || item.subject || item.client_name || "Untitled RFQ";

  let dealId = item.deal_id;
  const createdDeal = !dealId;
  if (createdDeal) {
    const { data, error } = await supabase
      .from("deals")
      .insert({
        client_name: item.client_name,
        rfq_number: item.rfq_number,
        title,
        status: "intake_confirmed",
        stage: "intake_confirmed",
        received_date: received,
        closing_date: item.closing_date,
        ...triageFields,
      })
      .select("id")
      .single();
    if (error) throw error;
    dealId = data.id;
  }

  let rfqId = null;
  try {
    const clientId = await resolveOrCreateClient(item.client_name);
    const { data: rfq, error: rfqError } = await supabase
      .from("rfqs")
      .insert({
        client_id: clientId,
        rfq_number: item.rfq_number,
        title,
        status: "intake_confirmed",
        received_date: received,
        closing_date: item.closing_date,
        notes: item.subject,
        deal_id: dealId,
      })
      .select("id")
      .single();
    if (rfqError) throw rfqError;
    rfqId = rfq.id;

    const lines = (item.items_detected ?? []).map(itemName).filter(Boolean);
    if (lines.length) {
      const { error: linesError } = await supabase
        .from("rfq_lines")
        .insert(lines.map((description, i) => ({ rfq_id: rfqId, line_number: i + 1, description, quantity: 1 })));
      if (linesError) throw linesError;
    }

    const { error: dealError } = await supabase
      .from("deals")
      .update({ rfq_id: rfqId, status: "intake_confirmed", stage: "intake_confirmed", stage_changed_at: now, ...triageFields })
      .eq("id", dealId);
    if (dealError) throw dealError;

    const { error } = await supabase
      .from("triage_queue")
      .update({ status: "accepted", deal_id: dealId, processed_at: now })
      .eq("id", item.id);
    if (error) throw error;
  } catch (e) {
    await unwind(
      () => rfqId && supabase.from("rfqs").delete().eq("id", rfqId),
      () => createdDeal && supabase.from("deals").delete().eq("id", dealId)
    );
    throw e;
  }
}

export async function declineItem(item, reason) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("triage_queue")
    .update({
      status: "declined",
      claude_reason: `${item.claude_reason ?? ""}${DECLINE_MARK}${reason}`.replace(/^\s+/, ""),
      processed_at: now,
    })
    .eq("id", item.id);
  if (error) throw error;
  if (item.deal_id) {
    const { error: dealError } = await supabase
      .from("deals")
      .update({ status: "declined", stage: "declined", stage_changed_at: now, triage_date: now })
      .eq("id", item.deal_id);
    if (dealError) throw dealError;
  }
}

/** Override is stored on the queue row (and its deal) but only changes the display. */
export async function setOverride(item, value) {
  const { error } = await supabase.from("triage_queue").update({ triage_override: value }).eq("id", item.id);
  if (error) throw error;
  if (item.deal_id) await supabase.from("deals").update({ triage_override: value }).eq("id", item.deal_id);
}

/**
 * Reverses a decision: the item returns to the queue and its deal to triage_pending.
 * An accepted item's rfqs row is removed, unless it has already moved on in the Pipeline.
 */
export async function undoItem(item) {
  if (item.deal_id) {
    const { data: deal } = await supabase.from("deals").select("rfq_id").eq("id", item.deal_id).maybeSingle();
    if (item.status === "accepted" && deal?.rfq_id) {
      const { data: rfq } = await supabase.from("rfqs").select("status").eq("id", deal.rfq_id).maybeSingle();
      if (rfq && rfq.status !== "intake_confirmed") throw new Error("This RFQ has already moved on in the Pipeline.");
    }
    const { error: dealError } = await supabase
      .from("deals")
      .update({ status: "triage_pending", stage: "triage_pending", rfq_id: null, stage_changed_at: new Date().toISOString() })
      .eq("id", item.deal_id);
    if (dealError) throw dealError;
    if (item.status === "accepted" && deal?.rfq_id) await supabase.from("rfqs").delete().eq("id", deal.rfq_id);
  }
  const { error } = await supabase
    .from("triage_queue")
    .update({
      status: "pending",
      processed_at: null,
      claude_reason: item.claude_reason?.split(DECLINE_MARK)[0] || null,
    })
    .eq("id", item.id);
  if (error) throw error;
}

/** Claude's own reason without the appended decline reason. */
export const splitReason = (reason) => {
  const [base, declined] = (reason ?? "").split(DECLINE_MARK);
  return { base, declined };
};
