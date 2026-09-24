import { supabase } from "./supabaseClient";
import { landedCostPHP } from "./sourcing";

export const VAT_RATE = 0.12;
export const DEFAULT_MARKUP_PERCENT = 25;

export async function fetchQuoteBuilderRfqs() {
  const { data, error } = await supabase
    .from("rfqs")
    .select("id, title, rfq_number, closing_date, status, client_id, clients(name, address)")
    .eq("status", "sourced")
    .order("closing_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    clientName: r.clients?.name ?? null,
    clientAddress: r.clients?.address ?? null,
  }));
}

/** rfq_lines with their winning supplier_quote joined in. */
export async function fetchQuoteLines(rfqId) {
  const { data, error } = await supabase
    .from("rfq_lines")
    .select(
      "*, winning_quote:winning_supplier_quote_id(id, unit_price, brand, lead_time_days, suppliers(name))"
    )
    .eq("rfq_id", rfqId)
    .order("line_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPrimaryContact(clientId) {
  if (!clientId) return null;
  const { data } = await supabase
    .from("contacts")
    .select("id, name, email, title, is_primary")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Per-line pricing: landed cost, sell price, margin %, and the line total. */
export function computeLine(line, fxRate, markupPercent) {
  const unitPrice = Number(line.winning_quote?.unit_price ?? 0);
  const quantity = Number(line.quantity ?? 0);
  const landed = landedCostPHP(unitPrice, fxRate);
  const markup = Number(markupPercent ?? DEFAULT_MARKUP_PERCENT) / 100;
  const sellPrice = landed * (1 + markup);
  const marginPercent = sellPrice > 0 ? ((sellPrice - landed) / sellPrice) * 100 : 0;
  const lineTotal = sellPrice * quantity;

  return { landedCost: landed, sellPrice, marginPercent, lineTotal, quantity };
}

/** Aggregate totals across every computed line. */
export function computeTotals(computedLines) {
  const subtotal = computedLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const vat = subtotal * VAT_RATE;
  const grandTotal = subtotal + vat;
  const totalLanded = computedLines.reduce((sum, l) => sum + l.landedCost * l.quantity, 0);
  const blendedMarginPercent = subtotal > 0 ? ((subtotal - totalLanded) / subtotal) * 100 : 0;

  return { subtotal, vat, grandTotal, blendedMarginPercent };
}

/**
 * Task 4: writes the immutable quotation record, then flips the RFQ to
 * "quoted". Called after the user has approved the PDF preview and sent.
 */
export async function recordQuotationAndMarkQuoted({ rfq, lineItems, totals, fxRate, pdfUrl }) {
  const quoteNumber = rfq.rfq_number ? `Q-${rfq.rfq_number}` : `Q-${rfq.id.slice(0, 8)}`;

  const { data: quotation, error: quoteError } = await supabase
    .from("quotations")
    .insert({
      rfq_id: rfq.id,
      client_id: rfq.client_id,
      quote_number: quoteNumber,
      status: "sent",
      total_amount: totals.grandTotal,
      subtotal: totals.subtotal,
      vat_amount: totals.vat,
      blended_margin_percent: totals.blendedMarginPercent,
      fx_rate_used: fxRate,
      pdf_url: pdfUrl,
      line_items: lineItems,
      sent_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (quoteError) throw quoteError;

  const { error: rfqError } = await supabase
    .from("rfqs")
    .update({ status: "quoted" })
    .eq("id", rfq.id);
  if (rfqError) throw rfqError;

  return quotation;
}

export function buildCoverEmail({ rfq, contact, totals }) {
  const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
  const greetingName = contact?.name ? contact.name.split(" ")[0] : "there";
  const subject = `Quotation — ${rfq.rfq_number || rfq.id} — ${rfq.clientName || "Client"}`;
  const body = `Hi ${greetingName},

Please find our quotation for ${rfq.rfq_number ? `RFQ ${rfq.rfq_number}` : "your recent request"} attached (download link below if your mail app strips attachments from mailto links).

Grand total: ${currency.format(totals.grandTotal)} (VAT inclusive)

Let us know if you have any questions or would like to proceed — happy to walk through the pricing or lead times on a call.

Best regards,
Khalil Joseph Banares
Engineering Solutions Director
Ultra Power Industrial Resources Inc.`;

  return { subject, body };
}
