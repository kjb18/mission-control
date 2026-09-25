// Supabase Edge Function: clickup-proxy
//
// Forwards requests to the ClickUp API with CLICKUP_API_KEY injected
// server-side — the key never reaches the browser. Requires a real
// authenticated owner session (see _shared/auth.ts); a request bearing
// only the public anon key gets a 401, not a forwarded ClickUp call.
//
// Input: { method?: "GET"|"POST"|"PUT", path: string, body?: object }
// `path` must start with /folder/, /list/, or /task/ — the only ClickUp
// endpoints this app actually uses — as defense in depth against an
// authenticated-but-compromised session being used to hit arbitrary
// ClickUp endpoints.
//
// Requires the Edge Function secret CLICKUP_API_KEY (`supabase secrets set`).

import { requireOwner, unauthorized, corsHeaders, errorMessage } from "../_shared/auth.ts";

const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const ALLOWED_PATH = /^\/(folder|list|task)\//;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const user = await requireOwner(req);
  if (!user) return unauthorized();

  try {
    const { method = "GET", path, body } = await req.json();
    if (!path || !ALLOWED_PATH.test(path)) {
      throw new Error("Invalid or disallowed ClickUp path.");
    }

    const apiKey = Deno.env.get("CLICKUP_API_KEY");
    if (!apiKey) {
      throw new Error("CLICKUP_API_KEY is not set. Run `supabase secrets set CLICKUP_API_KEY=...`.");
    }

    const res = await fetch(`${CLICKUP_BASE}${path}`, {
      method,
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
