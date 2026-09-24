// Supabase Edge Function: send-invoice
//
// Sends a transactional invoice-notification email via Brevo. Runs
// server-side only — the Brevo API key never reaches the browser.
//
// Input: { invoice_id }
// Fetches the invoice, its client, and the client's primary contact
// itself (service role — fresh data, not whatever the caller happened to
// have in memory), then calls Brevo's transactional email API.
//
// Requires these Edge Function secrets:
//   BREVO_API_KEY             — set via `supabase secrets set`
//   SUPABASE_URL               — auto-provided by the Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY  — auto-provided by the Supabase runtime

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SENDER = { name: "Ultra Power Industrial Resources Inc", email: "noreply@ultrapowerindustrialinc.com" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const money = (n: number) =>
  Number(n ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildEmail(invoice: any, clientName: string) {
  const subject = `Invoice — ${invoice.invoice_number} — Ultra Power Industrial Resources Inc`;
  const textContent = `Dear ${clientName},

Please find your invoice details below.

Invoice Number: ${invoice.invoice_number}
Amount Due: PHP ${money(invoice.amount)}
Issued: ${invoice.issued_date ?? "—"}
Due Date: ${invoice.due_date ?? "—"}

Thank you for your business. Please let us know if you have any questions regarding this invoice.

Best regards,
Ultra Power Industrial Resources Inc.`;

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:560px;margin:0 auto;">
      <h2 style="color:#0f172a;">Invoice ${invoice.invoice_number}</h2>
      <p>Dear ${clientName},</p>
      <p>Please find your invoice details below.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:6px 0;color:#555;">Invoice Number</td><td style="padding:6px 0;text-align:right;">${invoice.invoice_number}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Amount Due</td><td style="padding:6px 0;text-align:right;font-weight:bold;">PHP ${money(invoice.amount)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Issued</td><td style="padding:6px 0;text-align:right;">${invoice.issued_date ?? "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Due Date</td><td style="padding:6px 0;text-align:right;">${invoice.due_date ?? "—"}</td></tr>
      </table>
      <p>Thank you for your business. Please let us know if you have any questions regarding this invoice.</p>
      <p>Best regards,<br/>Ultra Power Industrial Resources Inc.</p>
    </div>`;

  return { subject, textContent, htmlContent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id is required.");

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) {
      throw new Error("BREVO_API_KEY is not set. Run `supabase secrets set BREVO_API_KEY=...`.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, clients(name)")
      .eq("id", invoice_id)
      .single();
    if (invoiceError) throw invoiceError;

    const clientName = invoice.clients?.name ?? "Valued Client";

    const { data: contact } = await supabase
      .from("contacts")
      .select("name, email")
      .eq("client_id", invoice.client_id)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!contact?.email) {
      throw new Error(`No contact email on file for this client — add one in Contacts before sending.`);
    }

    const { subject, textContent, htmlContent } = buildEmail(invoice, clientName);

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: contact.email, name: contact.name }],
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (!brevoRes.ok) {
      const detail = await brevoRes.text().catch(() => "");
      throw new Error(`Brevo API ${brevoRes.status}: ${detail}`);
    }

    const brevoData = await brevoRes.json();
    return new Response(JSON.stringify({ ok: true, messageId: brevoData.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
