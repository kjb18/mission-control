import { supabase } from "./supabaseClient";
import { todayISODate } from "./dateUtils";

export const PRIORITIES = ["Hot", "Medium", "Low", "Nurturing"];

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
  const { data, error } = await supabase.from("crosshairs_targets").select("*");
  if (error) throw error;
  return sortTargets(data ?? []);
}

export async function fetchTarget(id) {
  const { data, error } = await supabase.from("crosshairs_targets").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createTarget(fields) {
  const { data, error } = await supabase.from("crosshairs_targets").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateTarget(id, fields) {
  const { data, error } = await supabase
    .from("crosshairs_targets")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTarget(id) {
  const { error } = await supabase.from("crosshairs_targets").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTouchpoints(targetId) {
  const { data, error } = await supabase
    .from("crosshairs_touchpoints")
    .select("*")
    .eq("target_id", targetId)
    .order("touchpoint_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Task 1: log a touchpoint and bump the target's last_touchpoint_date. */
export async function logTouchpoint(targetId, { date, note }) {
  const touchpointDate = date || todayISODate();

  const { error: insertError } = await supabase
    .from("crosshairs_touchpoints")
    .insert({ target_id: targetId, touchpoint_date: touchpointDate, note });
  if (insertError) throw insertError;

  const { data, error: updateError } = await supabase
    .from("crosshairs_targets")
    .update({ last_touchpoint_date: touchpointDate })
    .eq("id", targetId)
    .select()
    .single();
  if (updateError) throw updateError;
  return data;
}

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
    const { data: cached } = await supabase
      .from("crosshairs_targets")
      .select("*")
      .eq("id", log.crosshairs_rotation.target_id)
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
