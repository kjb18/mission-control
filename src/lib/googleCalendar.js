const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;
const BASE_URL = "https://www.googleapis.com/calendar/v3";

// Writing events (push) requires Google OAuth 2.0 user consent — a plain
// API key can only read public calendar data, never insert/update events.
// Flip this on once an OAuth Client ID is wired up (see README).
export const CALENDAR_PUSH_ENABLED = false;

export const DEFAULT_REMINDER_MINUTES = 5;

export function isGoogleCalendarConfigured() {
  return Boolean(API_KEY && CALENDAR_ID);
}

export async function listEvents({ timeMin, timeMax }) {
  if (!isGoogleCalendarConfigured()) {
    return { events: [], error: "Google Calendar is not configured." };
  }

  const params = new URLSearchParams({
    key: API_KEY,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`
  );

  if (!res.ok) {
    if (res.status === 404 || res.status === 403) {
      return {
        events: [],
        error:
          "Calendar not accessible. In Google Calendar settings, share this calendar publicly (Access permissions → Make available to public) so the API key can read it.",
      };
    }
    return { events: [], error: `Google Calendar API ${res.status}` };
  }

  const data = await res.json();
  const events = (data.items ?? []).map(normalizeEvent);
  return { events, error: null };
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

/**
 * Push a Mission Control time block to Google Calendar as an event with a
 * 5-minute popup reminder. Disabled until OAuth is configured — API keys
 * cannot authorize writes. Returns { skipped: true, reason } in that case
 * so callers can surface a clear, non-error status instead of a 401/403.
 */
export async function createEvent({ title, start, end, description }) {
  if (!CALENDAR_PUSH_ENABLED) {
    return {
      skipped: true,
      reason:
        "Google Calendar push is inactive: writing events requires OAuth 2.0, not just an API key. Read-sync is active.",
    };
  }

  // Left in place for when OAuth is added — this call will 401 with an API
  // key alone, since Calendar write endpoints require a Bearer access token.
  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: title,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: DEFAULT_REMINDER_MINUTES }],
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Calendar API ${res.status}`);
  }
  return res.json();
}
