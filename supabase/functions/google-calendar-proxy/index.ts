// Supabase Edge Function: google-calendar-proxy
//
// Read-only fallback path for when Google Calendar isn't connected via
// OAuth (src/lib/googleAuth.js) — forwards to the Calendar API with
// GOOGLE_API_KEY injected server-side. The OAuth read/write path stays
// entirely client-side by design (the user's own short-lived access
// token is the correct client-side credential there, unlike a static
// API key baked into a build); this proxy only replaces the old
// VITE_GOOGLE_API_KEY fallback read.
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
    const { calendarId, timeMin, timeMax } = await req.json();
    if (!calendarId || !timeMin || !timeMax) {
      throw new Error("calendarId, timeMin, and timeMax are required.");
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY is not set. Run `supabase secrets set GOOGLE_API_KEY=...`.");
    }

    const params = new URLSearchParams({
      key: apiKey,
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, status: res.status, error: data?.error?.message ?? `Google Calendar API ${res.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, items: data.items ?? [] }), {
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
