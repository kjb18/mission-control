// Supabase Edge Function: parse-rfq
//
// Modes:
//   1. Extraction — { input_type: "text"|"pdf"|"image", text?, file_base64?, media_type? }
//      Calls Claude to extract client name, RFQ reference, closing date, and
//      line items from raw email text or an uploaded PDF/image, then runs
//      part-signature matching on the result.
//   2. Match-only — { mode: "match_only", parsed: { line_items: [...] } }
//      Skips Claude entirely and just runs part-signature matching. Used for
//      the iOS Shortcut webhook path, which already hands over parsed JSON.
//   3. Draft outreach — { mode: "draft_outreach", description, quantity?, unit? }
//      Drafts a supplier outreach email for one line item. Deliberately
//      never receives client_name/rfq_reference/closing_date at all — the
//      "must not mention" requirement is enforced by never handing Claude
//      that data, not just by asking it not to.
//
// Requires these Edge Function secrets (see README):
//   ANTHROPIC_API_KEY        — set via `supabase secrets set`
//   SUPABASE_URL              — auto-provided by the Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by the Supabase runtime

import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SYSTEM_PROMPT =
  "You are an RFQ parser for Ultra Power Industrial Resources. Extract client name, RFQ reference number, closing date, and each line item with description, quantity, and unit. Check each description against the part_signatures table for previous matches. Return valid JSON only, no prose.";

const JSON_SCHEMA_HINT = `Return JSON in exactly this shape, with no markdown fences and no other text:
{
  "client_name": string | null,
  "rfq_reference": string | null,
  "closing_date": string | null,  // ISO format YYYY-MM-DD, or null if not stated
  "line_items": [
    { "description": string, "quantity": number | null, "unit": string | null }
  ]
}`;

const SIMILARITY_THRESHOLD = 0.25;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeDescription(description: string) {
  return description
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractWithClaude(body: any) {
  const anthropic = anthropicClient();

  const content: any[] = [];
  if (body.input_type === "pdf" && body.file_base64) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: body.file_base64,
      },
    });
  } else if (body.input_type === "image" && body.file_base64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: body.media_type || "image/png",
        data: body.file_base64,
      },
    });
  }

  const textInstruction =
    body.input_type === "text"
      ? `${JSON_SCHEMA_HINT}\n\nEmail text follows:\n\n${body.text ?? ""}`
      : `${JSON_SCHEMA_HINT}\n\nExtract the RFQ from the attached document.`;
  content.push({ type: "text", text: textInstruction });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((b: any) => b.type === "text");
  if (!textBlock) throw new Error("Claude returned no text content.");

  const jsonText = (textBlock as any).text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error(`Claude did not return valid JSON: ${jsonText.slice(0, 300)}`);
  }
}

const OUTREACH_SYSTEM_PROMPT =
  "You are a procurement coordinator for Ultra Power Industrial Resources drafting a first-contact sourcing email to a supplier. Request unit price and lead time for the item described. Keep it short, professional, and generic — you have not been given any client name, RFQ reference, or closing date, and must not invent or reference any. Return valid JSON only, no prose.";

function anthropicClient() {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Run `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`."
    );
  }
  return new Anthropic({ apiKey });
}

function extractJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

async function draftOutreachEmail(body: any) {
  const anthropic = anthropicClient();
  const quantityLine = body.quantity ? `Quantity: ${body.quantity} ${body.unit ?? ""}`.trim() : "";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: OUTREACH_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Item: ${body.description}\n${quantityLine}\n\nReturn JSON in exactly this shape, no markdown fences, no other text:\n{ "subject": string, "body": string }`,
      },
    ],
  });

  const textBlock = message.content.find((b: any) => b.type === "text");
  if (!textBlock) throw new Error("Claude returned no text content.");

  try {
    return extractJson((textBlock as any).text);
  } catch {
    throw new Error(`Claude did not return valid JSON: ${(textBlock as any).text.slice(0, 300)}`);
  }
}

async function getQuoteHistory(supabase: any, partSignatureId: string) {
  const { data: rfqLines } = await supabase
    .from("rfq_lines")
    .select("id")
    .eq("part_signature_id", partSignatureId);

  const lineIds = (rfqLines ?? []).map((l: any) => l.id);
  if (lineIds.length === 0) return [];

  const { data: quotes } = await supabase
    .from("supplier_quotes")
    .select("unit_price, quoted_at, supplier_id")
    .in("rfq_line_id", lineIds)
    .order("quoted_at", { ascending: false })
    .limit(3);

  if (!quotes?.length) return [];

  const supplierIds = [...new Set(quotes.map((q: any) => q.supplier_id).filter(Boolean))];
  const { data: suppliers } = supplierIds.length
    ? await supabase.from("suppliers").select("id, name").in("id", supplierIds)
    : { data: [] };

  const nameById = Object.fromEntries((suppliers ?? []).map((s: any) => [s.id, s.name]));

  return quotes.map((q: any) => ({
    unitPrice: q.unit_price,
    quotedAt: q.quoted_at,
    supplierName: nameById[q.supplier_id] ?? "Unknown supplier",
  }));
}

async function matchLineItems(supabase: any, lineItems: any[]) {
  const results = [];

  for (const line of lineItems ?? []) {
    const normalized = normalizeDescription(line.description ?? "");
    let matches: any[] = [];

    if (normalized) {
      const { data: candidates } = await supabase.rpc("match_part_signatures", {
        search_text: normalized,
        match_limit: 3,
        min_similarity: SIMILARITY_THRESHOLD,
      });

      if (candidates?.length) {
        matches = await Promise.all(
          candidates.map(async (candidate: any) => ({
            ...candidate,
            recent_quotes: await getQuoteHistory(supabase, candidate.id),
          }))
        );
      }
    }

    results.push({ ...line, normalized_description: normalized, matches });
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (body.mode === "draft_outreach") {
      const draft = await draftOutreachEmail(body);
      return new Response(JSON.stringify(draft), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const parsed = body.mode === "match_only" ? body.parsed : await extractWithClaude(body);
    const lines = await matchLineItems(supabase, parsed.line_items);

    return new Response(
      JSON.stringify({
        rfq: {
          client_name: parsed.client_name ?? null,
          rfq_reference: parsed.rfq_reference ?? null,
          closing_date: parsed.closing_date ?? null,
        },
        lines,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Supabase's PostgrestError (and similar) are plain objects with a
// `.message`, not `instanceof Error` — String(error) on those silently
// stringifies to "[object Object]" instead of anything useful.
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
