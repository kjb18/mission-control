// Shared by every Edge Function in this project.
//
// Supabase's platform-level "verify JWT" (on by default for every
// deployed function unless deployed with --no-verify-jwt) only checks
// that the Authorization header carries a token *validly signed* by the
// project's JWT secret. The public anon key is itself such a token —
// it's meant to be public, embedded in the client bundle — so that check
// alone does NOT mean the caller is a logged-in user. Every prior
// function in this project (parse-rfq, render-quotation, send-invoice)
// was tested during earlier sessions using only the anon key with no
// real login, and all three worked — live proof the gap was real, not
// hypothetical. requireOwner() closes it: it calls auth.getUser() on the
// bearer token, which only succeeds for a genuine authenticated session,
// then checks the email matches this single-user app's owner — the same
// check the database's is_owner() RLS function makes.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const OWNER_EMAIL = "khalil@ultrapowerindustrialinc.com";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function requireOwner(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  if (data.user.email.toLowerCase() !== OWNER_EMAIL) return null;

  return data.user;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
