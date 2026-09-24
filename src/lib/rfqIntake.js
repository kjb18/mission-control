import { supabase } from "./supabaseClient";
import { createTask, CLICKUP_RFQ_TASK_LIST_ID } from "./clickup";
import { createEvent, EVENT_COLOR_IDS } from "./googleCalendar";

async function resolveOrCreateClient(name) {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("clients")
    .insert({ name: trimmed })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

/**
 * Writes the reviewed/edited RFQ + line items to rfqs/rfq_lines, then
 * (best-effort, non-fatal on failure) creates the matching ClickUp task and
 * Google Calendar event for the closing date.
 */
export async function confirmRfq({ rfq, lines }) {
  const clientId = await resolveOrCreateClient(rfq.client_name);

  const { data: rfqRow, error: rfqError } = await supabase
    .from("rfqs")
    .insert({
      client_id: clientId,
      rfq_number: rfq.rfq_reference || null,
      title: rfq.rfq_reference ? `RFQ ${rfq.rfq_reference}` : rfq.client_name || "Untitled RFQ",
      status: "open",
      closing_date: rfq.closing_date || null,
      received_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (rfqError) throw rfqError;

  if (lines?.length) {
    const rows = lines.map((line, i) => ({
      rfq_id: rfqRow.id,
      part_signature_id: line.acceptedMatchId ?? null,
      line_number: i + 1,
      description: line.description,
      quantity: line.quantity ?? 1,
      unit: line.unit ?? "ea",
    }));
    const { error: linesError } = await supabase.from("rfq_lines").insert(rows);
    if (linesError) throw linesError;
  }

  const downstream = { clickup: null, calendar: null };

  try {
    const title = `Source and quote ${rfq.rfq_reference || rfqRow.id} — closes ${rfq.closing_date || "TBD"}`;
    const task = await createTask(CLICKUP_RFQ_TASK_LIST_ID, {
      name: title,
      dueDate: rfq.closing_date ? new Date(`${rfq.closing_date}T09:00:00`) : null,
      description: `Auto-created from Mission Control Intake.\nClient: ${rfq.client_name || "Unknown"}\nRFQ: ${rfq.rfq_reference || "N/A"}`,
    });
    downstream.clickup = { ok: true, url: task.url };
  } catch (err) {
    downstream.clickup = { ok: false, error: err.message };
  }

  if (rfq.closing_date) {
    try {
      const start = new Date(`${rfq.closing_date}T09:00:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const result = await createEvent({
        title: `RFQ closing: ${rfq.rfq_reference || rfq.client_name || "Untitled"}`,
        start,
        end,
        colorId: EVENT_COLOR_IDS.amber,
      });
      downstream.calendar = result?.skipped
        ? { ok: false, error: result.reason }
        : { ok: true };
    } catch (err) {
      downstream.calendar = { ok: false, error: err.message };
    }
  }

  return { rfq: rfqRow, downstream };
}
