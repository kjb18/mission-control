import { supabase } from "./supabaseClient";

export async function sendInvoiceEmail(invoiceId) {
  const { data, error } = await supabase.functions.invoke("send-invoice", {
    body: { invoice_id: invoiceId },
  });
  if (error) throw new Error(error.message ?? "Failed to send invoice email.");
  return data;
}
