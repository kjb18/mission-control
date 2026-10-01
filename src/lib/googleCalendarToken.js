import { supabase } from "./supabaseClient";

// The Google Calendar OAuth token saved from Settings in
// app_settings.google_calendar_token = { access_token, expiry } (expiry in
// epoch ms; migration 0018). Stored in Supabase so every device the owner
// signs in on can read the calendar, not just the browser that connected.

export const LAST_SYNCED_KEY = "mc_gcal_last_synced";

export async function fetchSavedCalendarToken() {
  const { data, error } = await supabase.from("app_settings").select("google_calendar_token").eq("id", true).maybeSingle();
  if (error) throw error;
  const t = data?.google_calendar_token;
  return t?.access_token ? { access_token: t.access_token, expiry: Number(t.expiry) || 0 } : null;
}

/** "valid" | "expired" | "none" */
export function calendarTokenState(token) {
  if (!token) return "none";
  return Date.now() < token.expiry ? "valid" : "expired";
}

export async function saveCalendarToken(accessToken, expiry) {
  const { error } = await supabase
    .from("app_settings")
    .update({ google_calendar_token: { access_token: accessToken, expiry } })
    .eq("id", true);
  if (error) throw error;
}

export async function clearCalendarToken() {
  const { error } = await supabase.from("app_settings").update({ google_calendar_token: null }).eq("id", true);
  if (error) throw error;
}

export function lastSynced() {
  try {
    const v = localStorage.getItem(LAST_SYNCED_KEY);
    return v ? new Date(Number(v)) : null;
  } catch {
    return null;
  }
}

export function markSynced() {
  try {
    localStorage.setItem(LAST_SYNCED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
