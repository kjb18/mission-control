import { supabase } from "./supabaseClient";
import { getClientId } from "./googleAuth";

// Google Calendar connection (authorization-code flow, migration 0019).
// The refresh token stays server-side in google_oauth_tokens. The app sees
// app_settings.google_calendar_token = { access_token, expiry, connected,
// connected_at, last_synced } — written by the google-calendar-auth and
// google-calendar-proxy Edge Functions.

/** Connection status for Settings: { connected, lastSynced, connectedAt } or null. */
export async function fetchCalendarConnection() {
  const { data, error } = await supabase.from("app_settings").select("google_calendar_token").eq("id", true).maybeSingle();
  if (error) throw error;
  const t = data?.google_calendar_token;
  if (!t) return null;
  return {
    connected: Boolean(t.connected),
    lastSynced: t.last_synced ? new Date(t.last_synced) : null,
    connectedAt: t.connected_at ? new Date(t.connected_at) : null,
  };
}

async function callAuth(body) {
  const { data, error } = await supabase.functions.invoke("google-calendar-auth", { body });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message ?? "google-calendar-auth failed");
  }
  if (!data?.ok) throw new Error(data?.error ?? "google-calendar-auth failed");
  return data;
}

/** Exchanges a code from requestAuthCode(); returns { access_token, expiry }. */
export function connectWithCode(code) {
  return callAuth({ code, client_id: getClientId() });
}

/** Revokes the refresh token at Google and clears the stored connection. */
export function disconnectCalendar() {
  return callAuth({ mode: "disconnect" });
}
