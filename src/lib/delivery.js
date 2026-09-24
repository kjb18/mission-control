import { supabase } from "./supabaseClient";
import { sendInvoiceEmail } from "./sendInvoice";

const INVOICE_TERMS_DAYS = 30;

/** The PO for this RFQ, traced through quotations (see migration 0006 note). */
export async function fetchPurchaseOrderForRfq(rfqId) {
  const { data: quotation } = await supabase
    .from("quotations")
    .select("id")
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!quotation) return null;

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("quotation_id", quotation.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return po ?? null;
}

/** Pre-fill source: the RFQ's original line items ("PO lines" — see migration note). */
export async function fetchRfqLinesForDelivery(rfqId) {
  const { data, error } = await supabase
    .from("rfq_lines")
    .select("id, description, quantity, unit")
    .eq("rfq_id", rfqId)
    .order("line_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function uploadDeliveryPhoto(rfqId, file) {
  if (!file) return null;
  const path = `${rfqId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("deliveries").upload(path, file);
  if (error) throw error;
  return path;
}

/**
 * Task 3: confirm delivery, opened from the Awarded column. Updates PO and
 * RFQ to "delivered", writes the delivery record, creates the invoice, and
 * (best-effort, non-fatal) emails it via send-invoice.
 */
export async function confirmDelivery({
  rfq,
  purchaseOrder,
  deliveryDate,
  deliveryNoteNumber,
  itemsDelivered,
  photoFile,
}) {
  const photoPath = await uploadDeliveryPhoto(rfq.id, photoFile);

  const { error: deliveryError } = await supabase.from("deliveries").insert({
    purchase_order_id: purchaseOrder.id,
    status: "delivered",
    delivery_date: deliveryDate,
    delivery_note_number: deliveryNoteNumber,
    photo_path: photoPath,
    items_delivered: itemsDelivered,
  });
  if (deliveryError) throw deliveryError;

  const { error: poError } = await supabase
    .from("purchase_orders")
    .update({ status: "delivered" })
    .eq("id", purchaseOrder.id);
  if (poError) throw poError;

  const { error: rfqError } = await supabase.from("rfqs").update({ status: "delivered" }).eq("id", rfq.id);
  if (rfqError) throw rfqError;

  const issuedDate = new Date();
  const dueDate = new Date(issuedDate.getTime() + INVOICE_TERMS_DAYS * 24 * 60 * 60 * 1000);
  const invoiceNumber = `INV-${purchaseOrder.po_number || purchaseOrder.id.slice(0, 8)}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      purchase_order_id: purchaseOrder.id,
      client_id: rfq.client_id,
      invoice_number: invoiceNumber,
      status: "unpaid",
      amount: purchaseOrder.total_amount,
      issued_date: issuedDate.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (invoiceError) throw invoiceError;

  let emailResult = { ok: true };
  try {
    await sendInvoiceEmail(invoice.id);
  } catch (err) {
    emailResult = { ok: false, error: err.message };
  }

  return { invoice, emailResult };
}
