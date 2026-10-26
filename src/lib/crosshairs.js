import { supabase } from "./supabaseClient";
import { todayISODate } from "./dateUtils";
import { PRIORITIES, updateCompany, logCrosshairsTouchpoint } from "./companies";

// Crosshairs targets are companies with crosshairs_active = true (migration 0028).
// crosshairs_targets is no longer read or written; it stays in the database for rollback.
export { PRIORITIES };

const PRIORITY_RANK = { Hot: 0, Medium: 1, Low: 2, Nurturing: 2 };

function sortTargets(targets) {
  return [...targets].sort((a, b) => {
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rankDiff !== 0) return rankDiff;
    // Last touchpoint ascending (never-touched / oldest first) — most
    // neglected hot targets surface first within their priority tier.
    const aTime = a.last_touchpoint_date ? new Date(a.last_touchpoint_date).getTime() : 0;
    const bTime = b.last_touchpoint_date ? new Date(b.last_touchpoint_date).getTime() : 0;
    return aTime - bTime;
  });
}

export async function fetchTargets() {
  const { data, error } = await supabase
    .from("companies")
    .select("*, contacts(name)")
    .eq("crosshairs_active", true);
  if (error) throw error;
  return sortTargets(data ?? []);
}

export async function fetchTarget(id) {
  const { data, error } = await supabase.from("companies").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

/** Edits a Crosshairs company's fields. */
export const updateTarget = updateCompany;

/** Puts an existing company on Crosshairs with the given priority. */
export function addToCrosshairs(companyId, priority) {
  return updateCompany(companyId, { crosshairs_active: true, priority });
}

/** Takes a company off Crosshairs. The company and its history stay in the directory. */
export function removeFromCrosshairs(companyId) {
  return updateCompany(companyId, { crosshairs_active: false });
}

export async function fetchTouchpoints(companyId) {
  const { data, error } = await supabase
    .from("crosshairs_touchpoints")
    .select("*")
    .eq("company_id", companyId)
    .order("touchpoint_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Logs a touchpoint and bumps the company's last_touchpoint_date. */
export const logTouchpoint = logCrosshairsTouchpoint;

// --- Daily rotation (Task 2) ---------------------------------------------

function daysBetween(dateStr, now) {
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((todayMidnight - then) / 86400000);
}

function computeRotation(targets, now) {
  const dayIndex = Math.floor(now.getTime() / 86400000);
  const weekIndex = Math.floor(dayIndex / 7);

  const hot = targets.filter((t) => t.priority === "Hot");
  const neglectedHot = hot
    .filter((t) => !t.last_touchpoint_date || daysBetween(t.last_touchpoint_date, now) >= 2)
    .sort((a, b) => {
      const aTime = a.last_touchpoint_date ? new Date(a.last_touchpoint_date).getTime() : 0;
      const bTime = b.last_touchpoint_date ? new Date(b.last_touchpoint_date).getTime() : 0;
      return aTime - bTime;
    });
  if (neglectedHot.length) return { target: neglectedHot[0], tier: "hot" };

  const medium = [...targets.filter((t) => t.priority === "Medium")].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  if (medium.length) {
    // Same target shown for 2 consecutive calendar days, then the next.
    return { target: medium[Math.floor(dayIndex / 2) % medium.length], tier: "medium" };
  }

  const lowNurturing = [...targets.filter((t) => t.priority === "Low" || t.priority === "Nurturing")].sort(
    (a, b) => a.id.localeCompare(b.id)
  );
  if (lowNurturing.length) {
    return { target: lowNurturing[weekIndex % lowNurturing.length], tier: "low_nurturing" };
  }

  return null;
}

/**
 * Today's featured target for the homepage panel. Computed once per day
 * and cached on daily_logs.crosshairs_rotation so it stays stable for the
 * rest of the day even if a touchpoint gets logged in the meantime.
 */
export async function fetchTodaysRotatedTarget() {
  const todayISO = todayISODate();

  const { data: log } = await supabase
    .from("daily_logs")
    .select("id, crosshairs_rotation")
    .eq("log_date", todayISO)
    .maybeSingle();

  if (log?.crosshairs_rotation?.target_id) {
    // Migrated companies kept their old target ids, so a cached pick still resolves.
    const { data: cached } = await supabase
      .from("companies")
      .select("*")
      .eq("id", log.crosshairs_rotation.target_id)
      .eq("crosshairs_active", true)
      .maybeSingle();
    if (cached) return cached;
    // Target was deleted since — fall through and recompute.
  }

  const targets = await fetchTargets();
  const picked = computeRotation(targets, new Date());
  const rotationPayload = picked
    ? { target_id: picked.target.id, tier: picked.tier, computed_at: new Date().toISOString() }
    : null;

  if (log) {
    await supabase.from("daily_logs").update({ crosshairs_rotation: rotationPayload }).eq("id", log.id);
  } else {
    await supabase
      .from("daily_logs")
      .upsert({ log_date: todayISO, crosshairs_rotation: rotationPayload }, { onConflict: "log_date" });
  }

  return picked?.target ?? null;
}
