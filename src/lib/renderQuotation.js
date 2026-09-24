import { supabase } from "./supabaseClient";

/**
 * Calls the render-quotation Edge Function with the exact computed data the
 * user is looking at (WYSIWYG — what's approved is what's rendered), and
 * gets back a signed URL to the generated PDF in the private `quotations`
 * storage bucket.
 */
export async function renderQuotationPdf({ rfq, contact, lineItems, totals, quoteNumber }) {
  const { data, error } = await supabase.functions.invoke("render-quotation", {
    body: {
      rfq_id: rfq.id,
      quote_number: quoteNumber,
      client_name: rfq.clientName,
      client_address: rfq.clientAddress,
      contact_name: contact?.name ?? null,
      closing_date: rfq.closing_date,
      date: new Date().toISOString().slice(0, 10),
      lines: lineItems,
      subtotal: totals.subtotal,
      vat: totals.vat,
      grand_total: totals.grandTotal,
    },
  });
  if (error) throw new Error(error.message ?? "Failed to render quotation PDF.");
  return data; // { pdfUrl, path }
}
