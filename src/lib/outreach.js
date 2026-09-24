import { supabase } from "./supabaseClient";
import { checkSupplierBlacklist } from "./sourcing";

/**
 * Task 4 guard + Task 2 draft. Blacklist is checked fresh, right before
 * generating anything — never trust a stale flag from an earlier fetch.
 * Deliberately sends only description/quantity/unit to the Edge Function;
 * client name, RFQ reference, and closing date never leave this line item.
 */
export async function draftOutreachEmail({ supplierName, description, quantity, unit }) {
  const blacklisted = await checkSupplierBlacklist(supplierName);
  if (blacklisted) {
    return { blocked: true, reason: `${supplierName} is on the supplier blacklist.` };
  }

  const { data, error } = await supabase.functions.invoke("parse-rfq", {
    body: { mode: "draft_outreach", description, quantity, unit },
  });
  if (error) throw new Error(error.message ?? "Failed to draft outreach email.");
  return { blocked: false, subject: data.subject, body: data.body };
}

export function buildMailto({ to, subject, body }) {
  // Not URLSearchParams: it encodes spaces as "+", which some mail clients
  // (notably desktop Outlook) render literally instead of as spaces in a
  // mailto link. encodeURIComponent gives the %20 mailto actually expects.
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${to ?? ""}?${query}`;
}
