// Supabase Edge Function: google-calendar-proxy
//
// Reads Google Calendar events for the homepage.
//   - When Google Calendar is connected (Settings → google-calendar-auth),
//     it reads the stored access token from app_settings, refreshes it with
//     the stored refresh token once it has expired, and calls the Calendar
//     API as the owner — private events and full details come back.
//   - When it isn't connected (or the refresh fails) it falls back to
//     GOOGLE_API_KEY, which only sees calendars shared publicly.
//
// Response: { ok, items | error, auth: "oauth" | "api_key",
//             token_state: "valid" | "refresh_failed" | "none",
//             access_token?, expiry? } — the access token is returned so the
// browser can push events (createEvent) without its own sign-in.
//
// Requires a real authenticated owner session (see _shared/auth.ts).
// Always responds 200 with { ok, ... } except a 401 when not authenticated.

import { requireOwner, unauthorized, corsHeaders, errorMessage } from "../_shared/auth.ts";
import { adminClient, readPublicToken, refreshAccessToken, writePublicToken } from "../_shared/googleTokens.ts";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await requireOwner(req);
  if (!user) return unauthorized();

  try {
    const { calendarId, timeMin, timeMax } = await req.json();
    if (!calendarId || !timeMin || !timeMax) throw new Error("calendarId, timeMin, and timeMax are required.");

    // ---- Owner's OAuth token, refreshed when expired ----
    const db = adminClient();
    let token = await readPublicToken(db);
    let tokenState: "valid" | "refresh_failed" | "none" = "none";
    if (token?.connected || token?.access_token) {
      if (!token.access_token || Date.now() >= Number(token.expiry ?? 0)) {
        try {
          token = await refreshAccessToken(db);
        } catch (e) {
          console.error("google-calendar-proxy:", errorMessage(e));
          token = null;
          tokenState = "refresh_failed";
        }
      }
      if (token?.access_token) tokenState = "valid";
      else if (tokenState === "none") tokenState = "refresh_failed";
    }
    const accessToken = tokenState === "valid" ? String(token!.access_token) : null;

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!accessToken && !apiKey) throw new Error("Google Calendar isn't connected and GOOGLE_API_KEY is not set.");

    const params = new URLSearchParams({
      ...(accessToken ? {} : { key: apiKey! }),
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined
    );
    const data = await res.json().catch(() => ({}));
    const auth = accessToken ? "oauth" : "api_key";

    if (!res.ok) {
      return json({ ok: false, status: res.status, auth, token_state: tokenState, error: data?.error?.message ?? `Google Calendar API ${res.status}` });
    }

    if (accessToken) {
      await writePublicToken(db, { ...token, last_synced: new Date().toISOString() }).catch(() => {});
    }
    return json({
      ok: true,
      items: data.items ?? [],
      auth,
      token_state: tokenState,
      ...(accessToken ? { access_token: accessToken, expiry: Number(token!.expiry) } : {}),
    });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error) });
  }
});
