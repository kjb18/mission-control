// Supabase Edge Function: generate-learning-module
//
// Returns today's learning module (Asia/Manila date) for the signed-in
// owner. If one is already stored in learning_hub_modules it is returned
// as-is; otherwise Claude generates one, it's stored, and it's returned.
// A pending row in learning_hub_requests (used = false) steers the topic
// and is marked used once the module is saved.
//
// Database access runs with the caller's own JWT, so the owner-only RLS
// policies on both tables apply.
//
// Requires the Edge Function secret ANTHROPIC_API_KEY (already set for
// parse-rfq). SUPABASE_URL / SUPABASE_ANON_KEY are provided by the runtime.

import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { requireOwner, unauthorized, corsHeaders, errorMessage } from "../_shared/auth.ts";

const SYSTEM_PROMPT =
  "You are a learning module generator for Khalil Joseph Banares, Engineering Solutions Director at Ultra Power Industrial Resources Inc., a family-owned industrial distributor in the Philippines. Generate a daily learning module based on books and concepts relevant to B2B sales, industrial procurement, leadership, operations, and business strategy. Each module must be practical and directly applicable to running a small industrial trading business in the Philippines. Return valid JSON only with no prose or markdown.";

const USER_MESSAGE = `Generate today's learning module. Pick a book or concept that would be highly valuable for a B2B sales and operations professional. Return this exact JSON structure:
{
  book_title: string,
  book_author: string,
  book_source: string (full book title and author for attribution),
  category: one of Sales, Leadership, Strategy, Operations, Finance, Mindset,
  description: string (one sentence describing the concept),
  quote: string (a real memorable quote from or about this book, 20 to 40 words),
  quote_author: string,
  key_concepts: array of 4 to 6 strings each being a concept title,
  key_takeaway: string (2 to 3 sentences on the core insight),
  application: string (2 to 3 sentences on how to apply this specifically at Ultra Power Industrial Resources),
  cover_color: a hex color that fits the book's tone,
  cover_initial: the first letter of the book title
}`;

const CATEGORIES = ["Sales", "Leadership", "Strategy", "Operations", "Finance", "Mindset"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function manilaToday() {
  // en-CA formats as yyyy-MM-dd.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

function parseModule(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const m = JSON.parse(cleaned);
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const required = ["book_title", "book_author", "quote", "key_takeaway", "application"];
  for (const k of required) if (!str(m[k])) throw new Error(`Module is missing ${k}.`);
  const concepts = Array.isArray(m.key_concepts) ? m.key_concepts.map(str).filter(Boolean).slice(0, 6) : [];
  if (concepts.length < 1) throw new Error("Module has no key_concepts.");
  const category = CATEGORIES.find((c) => c.toLowerCase() === str(m.category).toLowerCase()) ?? "Strategy";
  const color = /^#[0-9a-f]{6}$/i.test(str(m.cover_color)) ? str(m.cover_color) : "#3b82f6";
  return {
    book_title: str(m.book_title),
    book_author: str(m.book_author),
    book_source: str(m.book_source) || `${str(m.book_title)} by ${str(m.book_author)}`,
    category,
    description: str(m.description) || null,
    quote: str(m.quote),
    quote_author: str(m.quote_author) || str(m.book_author),
    key_concepts: concepts,
    key_takeaway: str(m.key_takeaway),
    application: str(m.application),
    cover_color: color,
    cover_initial: (str(m.cover_initial) || str(m.book_title)).charAt(0).toUpperCase(),
  };
}

async function generate(anthropic: Anthropic, request: string | null) {
  const userMessage = request
    ? `${USER_MESSAGE}\n\nThe user asked for today's module to cover this topic — base it on this request:\n${request}`
    : USER_MESSAGE;
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  if ((message.stop_reason as string) === "refusal") throw new Error("Claude declined to generate this module.");
  const textBlock = message.content.find((b: any) => b.type === "text") as any;
  if (!textBlock) throw new Error("Claude returned no text content.");
  return parseModule(textBlock.text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await requireOwner(req);
  if (!user) return unauthorized();

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });
    const today = manilaToday();

    const existing = await supabase
      .from("learning_hub_modules")
      .select("*")
      .eq("generated_date", today)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return json({ module: existing.data, cached: true });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set. Run `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`.");
    const anthropic = new Anthropic({ apiKey });

    const pending = await supabase
      .from("learning_hub_requests")
      .select("id, request_text")
      .eq("user_id", user.id)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const request = pending.data?.request_text ?? null;

    // One retry covers the occasional reply that isn't clean JSON.
    let fields;
    try {
      fields = await generate(anthropic, request);
    } catch (first) {
      if (first instanceof Anthropic.APIError) throw first;
      fields = await generate(anthropic, request);
    }

    // ignoreDuplicates: if two tabs generate at once, the first insert wins
    // and both return the stored row.
    const inserted = await supabase
      .from("learning_hub_modules")
      .upsert({ ...fields, user_id: user.id, generated_date: today }, { onConflict: "generated_date,user_id", ignoreDuplicates: true });
    if (inserted.error) throw inserted.error;

    const stored = await supabase
      .from("learning_hub_modules")
      .select("*")
      .eq("generated_date", today)
      .eq("user_id", user.id)
      .single();
    if (stored.error) throw stored.error;

    if (pending.data) await supabase.from("learning_hub_requests").update({ used: true }).eq("id", pending.data.id);

    return json({ module: stored.data, cached: false });
  } catch (error) {
    console.error("generate-learning-module:", errorMessage(error));
    return json({ error: errorMessage(error) }, 500);
  }
});
