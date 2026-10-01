// Google OAuth token storage shared by google-calendar-auth and
// google-calendar-proxy. Uses the service role: the refresh token lives in
// google_oauth_tokens, which has no client-facing RLS policies.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

export const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export function clientSecret() {
  const secret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!secret) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not set. Run `supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=...`.");
  return secret;
}

/** The token object the app reads from app_settings.google_calendar_token. */
export async function readPublicToken(db: ReturnType<typeof adminClient>) {
  const { data } = await db.from("app_settings").select("google_calendar_token").eq("id", true).maybeSingle();
  return (data?.google_calendar_token ?? null) as Record<string, unknown> | null;
}

export async function writePublicToken(db: ReturnType<typeof adminClient>, value: Record<string, unknown> | null) {
  const { error } = await db.from("app_settings").update({ google_calendar_token: value }).eq("id", true);
  if (error) throw error;
}

/** Exchanges the stored refresh token for a fresh access token and saves it. */
export async function refreshAccessToken(db: ReturnType<typeof adminClient>) {
  const { data: stored } = await db.from("google_oauth_tokens").select("refresh_token, client_id").eq("id", true).maybeSingle();
  if (!stored) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: stored.client_id,
      client_secret: clientSecret(),
      refresh_token: stored.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token refresh failed: ${body.error_description ?? body.error ?? res.status}`);
  }
  const current = (await readPublicToken(db)) ?? {};
  const next = {
    ...current,
    access_token: body.access_token,
    expiry: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60_000,
    connected: true,
  };
  await writePublicToken(db, next);
  return next;
}
