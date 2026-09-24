import { supabase } from "./supabaseClient";

async function fetchLatestQuotationId(rfqId) {
  const { data } = await supabase
    .from("quotations")
    .select("id")
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function uploadPoDocument(rfqId, file) {
  if (!file) return null;
  const path = `${rfqId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("purchase-orders").upload(path, file);
  if (error) throw error;
  return path;
}

/** Task 4: manual PO receipt, opened from the Quoted column. */
export async function createPoReceipt({ rfqId, clientId, poNumber, poDate, poAmount, file }) {
  const [quotationId, poDocumentPath] = await Promise.all([
    fetchLatestQuotationId(rfqId),
    uploadPoDocument(rfqId, file),
  ]);

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .insert({
      quotation_id: quotationId,
      client_id: clientId,
      po_number: poNumber,
      order_date: poDate,
      total_amount: poAmount,
      status: "open",
      po_document_path: poDocumentPath,
    })
    .select()
    .single();
  if (poError) throw poError;

  const { error: rfqError } = await supabase.from("rfqs").update({ status: "awarded" }).eq("id", rfqId);
  if (rfqError) throw rfqError;

  return po;
}

export async function getSignedPoDocumentUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("purchase-orders")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
