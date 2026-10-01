// Supabase Edge Function: google-calendar-proxy
//
// Reads Google Calendar events for the homepage.
//   - With { access_token } in the body (the owner's OAuth token, saved from
//     Settings), it calls the Calendar API as the owner, so private events
//     and full details come back.
//   - Without one it falls back to GOOGLE_API_KEY, which only sees calendars
//     shared publicly (and only free/busy if that's how they're shared).
//
// Requires a real authenticated owner session (see _shared/auth.ts).
// Always responds 200 with { ok, items | error } so the client can
// branch on the result without needing to unwrap a wrapped HTTP error —
// the one exception is a real 401 when the caller isn't authenticated.
//
// Requires the Edge Function secret GOOGLE_API_KEY (`supabase secrets set`).

import { requireOwner, unauthorized, corsHeaders, errorMessage } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const user = await requireOwner(req);
  if (!user) return unauthorized();

  try {
    const { calendarId, timeMin, timeMax, access_token } = await req.json();
    if (!calendarId || !timeMin || !timeMax) {
      throw new Error("calendarId, timeMin, and timeMax are required.");
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!access_token && !apiKey) {
      throw new Error("No access_token sent and GOOGLE_API_KEY is not set.");
    }

    const params = new URLSearchParams({
      ...(access_token ? {} : { key: apiKey! }),
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      access_token ? { headers: { Authorization: `Bearer ${access_token}` } } : undefined
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, status: res.status, error: data?.error?.message ?? `Google Calendar API ${res.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, items: data.items ?? [], auth: access_token ? "oauth" : "api_key" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: errorMessage(error) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
