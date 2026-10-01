// Supabase Edge Function: google-calendar-auth
//
// Authorization-code flow for Google Calendar, so the connection survives
// past the one-hour access token. Settings gets a one-time code from Google
// Identity Services (initCodeClient, popup mode) and posts it here.
//
//   { code, client_id }      → exchange with redirect_uri "postmessage";
//                              refresh token → google_oauth_tokens (private),
//                              access token + expiry → app_settings.
//   { mode: "disconnect" }   → revoke at Google and clear both.
//
// Owner-only. Requires the secret GOOGLE_OAUTH_CLIENT_SECRET (falls back to
// GOOGLE_CLIENT_SECRET). The client ID is public, so the browser sends it
// (VITE_GOOGLE_CLIENT_ID); GOOGLE_OAUTH_CLIENT_ID overrides it if set.

import { requireOwner, unauthorized, corsHeaders, errorMessage } from "../_shared/auth.ts";
import { TOKEN_URL, adminClient, clientSecret, readPublicToken, writePublicToken } from "../_shared/googleTokens.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await requireOwner(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const db = adminClient();

    if (body.mode === "disconnect") {
      const { data: stored } = await db.from("google_oauth_tokens").select("refresh_token").eq("id", true).maybeSingle();
      if (stored?.refresh_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(stored.refresh_token)}`, { method: "POST" }).catch(() => {});
      }
      await db.from("google_oauth_tokens").delete().eq("id", true);
      await writePublicToken(db, null);
      return json({ ok: true });
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? body.client_id;
    if (!body.code || !clientId) throw new Error("code and client_id are required.");

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: body.code,
        client_id: clientId,
        client_secret: clientSecret(),
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      }),
    });
    const tokens = await res.json().catch(() => ({}));
    if (!res.ok || !tokens.access_token) {
      throw new Error(`Google code exchange failed: ${tokens.error_description ?? tokens.error ?? res.status}`);
    }

    // Google only sends a refresh token on first consent. Keep the stored one
    // if this exchange didn't include a new one.
    if (tokens.refresh_token) {
      const { error } = await db.from("google_oauth_tokens").upsert({
        id: true,
        refresh_token: tokens.refresh_token,
        client_id: clientId,
        scope: tokens.scope ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } else {
      const { data: stored } = await db.from("google_oauth_tokens").select("id").eq("id", true).maybeSingle();
      if (!stored) {
        throw new Error(
          "Google didn't return a refresh token. Remove Mission Control's access at myaccount.google.com/permissions, then connect again."
        );
      }
    }

    const expiry = Date.now() + (Number(tokens.expires_in) || 3600) * 1000 - 60_000;
    const current = (await readPublicToken(db)) ?? {};
    await writePublicToken(db, { ...current, access_token: tokens.access_token, expiry, connected: true, connected_at: new Date().toISOString() });
    return json({ ok: true, access_token: tokens.access_token, expiry });
  } catch (error) {
    console.error("google-calendar-auth:", errorMessage(error));
    return json({ ok: false, error: errorMessage(error) }, 400);
  }
});
