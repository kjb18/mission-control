import { supabase } from "./supabaseClient";

// Creates Google Calendar events through the google-calendar-proxy Edge
// Function (create_event). The event lands on the owner's primary calendar,
// syncs to Apple Calendar on the iPhone, and fires a native alarm
// `reminderMinutes` before it starts. Manila has no DST, so +08:00 is exact.

const MANILA_OFFSET = "+08:00";

/** "2026-10-07" + "09:00" → "2026-10-07T09:00:00+08:00" */
export function manilaIso(date, time) {
  const hhmm = String(time).slice(0, 5);
  return `${date}T${hhmm}:00${MANILA_OFFSET}`;
}

/** The Manila wall-clock ISO string `minutes` after a Manila date + time. */
export function manilaIsoPlus(date, time, minutes) {
  const instant = new Date(manilaIso(date, time)).getTime() + minutes * 60000;
  // sv-SE formats as "YYYY-MM-DD HH:MM:SS".
  const wall = new Date(instant).toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T");
  return `${wall}${MANILA_OFFSET}`;
}

/**
 * Returns { ok: true, id } or { ok: false, error }; never throws, so a calendar
 * failure can't block saving the task itself.
 */
export async function createCalendarEvent({ title, date, time, durationMinutes = 30, reminderMinutes = 30, description }) {
  try {
    const { data, error } = await supabase.functions.invoke("google-calendar-proxy", {
      body: {
        action: "create_event",
        summary: title,
        start: manilaIso(date, time),
        end: manilaIsoPlus(date, time, durationMinutes),
        reminders: [{ method: "popup", minutes: reminderMinutes }],
        ...(description ? { description } : {}),
      },
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? "Google Calendar create_event failed.");
    return { ok: true, id: data.id };
  } catch (e) {
    console.warn("[calendar] create_event failed:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Called when a task's properties are saved: creates the event only when both
 * date and time are set and something about them changed since the panel
 * opened (re-saving an unchanged task would otherwise add a duplicate event).
 * Returns null when nothing needed pushing.
 */
export function pushDueEventIfChanged({ title, fields, before }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.due_date ?? "") || !/^\d{2}:\d{2}/.test(fields.due_time ?? "")) return null;
  const same =
    before &&
    before.title === title &&
    before.fields?.due_date === fields.due_date &&
    (before.fields?.due_time ?? "").slice(0, 5) === fields.due_time.slice(0, 5);
  if (same) return null;
  return createCalendarEvent({ title, date: fields.due_date, time: fields.due_time, description: fields.notes || undefined });
}
