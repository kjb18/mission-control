import { getOrRenewAccessToken } from "./googleAuth";
import { supabase } from "./supabaseClient";

// The Google API key lives only in the google-calendar-proxy Edge
// Function's GOOGLE_API_KEY secret now — see
// supabase/functions/google-calendar-proxy. It never reaches the browser.
// The OAuth read/write path below stays entirely client-side by design:
// the user's own short-lived access token, obtained live via Google
// Identity Services, is the correct client-side credential — unlike a
// static API key baked into a build, it isn't a secret to protect.
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;
const BASE_URL = "https://www.googleapis.com/calendar/v3";

export const DEFAULT_REMINDER_MINUTES = 5;

// Google Calendar's fixed event colorId palette — there's no literal
// "amber", so Tangerine (orange) is the closest match.
export const EVENT_COLOR_IDS = {
  amber: "6", // Tangerine
};

export function isGoogleCalendarConfigured() {
  return Boolean(CALENDAR_ID);
}

/**
 * Reads prefer the user's OAuth token when connected — that works for
 * private calendars, unlike the API-key path (via the proxy), which only
 * works if the calendar's sharing settings make it public.
 */
export async function listEvents({ timeMin, timeMax }) {
  if (!CALENDAR_ID) {
    return { events: [], error: "Google Calendar is not configured." };
  }

  const accessToken = await getOrRenewAccessToken();

  if (accessToken) {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const res = await fetch(
      `${BASE_URL}/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return { events: [], error: `Google Calendar API ${res.status}` };
    const data = await res.json();
    return { events: (data.items ?? []).map(normalizeEvent), error: null };
  }

  const { data, error: invokeError } = await supabase.functions.invoke("google-calendar-proxy", {
    body: { calendarId: CALENDAR_ID, timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() },
  });

  if (invokeError || !data?.ok) {
    return {
      events: [],
      error:
        data?.error ??
        invokeError?.message ??
        "Calendar not accessible. Either share it publicly (Access permissions → Make available to public), or connect Google Calendar in Settings for private access.",
    };
  }

  return { events: (data.items ?? []).map(normalizeEvent), error: null };
}

function normalizeEvent(event) {
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;
  return {
    id: event.id,
    title: event.summary ?? "(untitled)",
    start: startRaw ? new Date(startRaw) : null,
    end: endRaw ? new Date(endRaw) : null,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    htmlLink: event.htmlLink,
    category: "meeting",
  };
}

function buildEventResource({ title, start, end, description, colorId, reminderMinutes }) {
  return {
    summary: title,
    description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    ...(colorId ? { colorId } : {}),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: reminderMinutes ?? DEFAULT_REMINDER_MINUTES },
      ],
    },
  };
}

/**
 * Creates a Google Calendar event. Requires an active OAuth connection
 * (Settings → Connect Google Calendar) — writes are never possible with an
 * API key alone. Returns { skipped: true, reason } instead of throwing when
 * not connected, so callers can show a clear status instead of a 401.
 */
export async function createEvent(options) {
  const accessToken = await getOrRenewAccessToken();
  if (!accessToken) {
    return {
      skipped: true,
      reason: "Google Calendar isn't connected — connect it in Settings to enable push.",
    };
  }

  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildEventResource(options)),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Calendar API ${res.status}`);
  }
  return res.json();
}

/** Updates an existing event created by createEvent (by its Google event id). */
export async function updateEvent(eventId, options) {
  const accessToken = await getOrRenewAccessToken();
  if (!accessToken) {
    return {
      skipped: true,
      reason: "Google Calendar isn't connected — connect it in Settings to enable push.",
    };
  }

  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildEventResource(options)),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Calendar API ${res.status}`);
  }
  return res.json();
}
