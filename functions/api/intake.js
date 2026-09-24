// Cloudflare Pages Function: POST /api/intake
//
// Receives already-parsed RFQ JSON from an iOS Shortcut and stages it in
// Supabase's intake_queue for review in the Intake page — it never writes
// to rfqs/rfq_lines directly, so a bad or malicious payload can only ever
// add a queue row, never touch real business data.
//
// Required Cloudflare Pages Function environment variables (set these in
// the Pages project's Settings → Environment variables — NOT the same list
// as the VITE_ build variables, and never exposed to the browser):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   INTAKE_WEBHOOK_SECRET

export async function onRequestPost(context) {
  const { request, env } = context;

  const providedSecret = request.headers.get("x-intake-secret");
  if (!env.INTAKE_WEBHOOK_SECRET || providedSecret !== env.INTAKE_WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }

  if (!payload || typeof payload !== "object") {
    return json({ error: "Body must be a JSON object" }, 400);
  }

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/intake_queue`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      source: "webhook",
      raw_input: JSON.stringify(payload),
      parsed: payload,
      status: "pending",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return json({ error: `Failed to queue intake: ${res.status} ${text}` }, 502);
  }

  const [row] = await res.json();
  return json({ ok: true, id: row?.id });
}

export async function onRequestGet() {
  return json({ ok: true, message: "POST an RFQ JSON body here with an x-intake-secret header." });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
