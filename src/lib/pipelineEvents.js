import { supabase } from "./supabaseClient";

// Shared event-source config for the weekly plan and month calendar dots.
// These four need to stay visually distinct from each other (they're a
// legend, not decoration), so they're the one deliberate exception to the
// rest of the app collapsing onto the constrained ops-center palette.
export const PIPELINE_SOURCES = [
  { table: "rfqs", dateColumn: "closing_date", label: "RFQ", color: "bg-amber-500", variant: "amber" },
  { table: "deliveries", dateColumn: "delivery_date", label: "Delivery", color: "bg-success", variant: "green" },
  { table: "invoices", dateColumn: "closing_date", label: "Invoice", color: "bg-blue-500", variant: "blue" },
];

export const MEETING_SOURCE = { label: "Meeting", color: "bg-violet-600", variant: "purple" };

export async function fetchPipelineEventsByDate(startISO, endISO) {
  const results = await Promise.all(
    PIPELINE_SOURCES.map(({ table, dateColumn }) =>
      supabase
        .from(table)
        .select(`id, ${dateColumn}`)
        .gte(dateColumn, startISO)
        .lte(dateColumn, endISO)
    )
  );

  const map = {};
  results.forEach((res, idx) => {
    const { dateColumn, label, color, variant } = PIPELINE_SOURCES[idx];
    (res.data ?? []).forEach((row) => {
      const date = row[dateColumn];
      if (!date) return;
      if (!map[date]) map[date] = [];
      map[date].push({ label, color, variant });
    });
  });

  return map;
}

export function mergeMeetingEvents(map, meetingEvents) {
  const next = { ...map };
  meetingEvents.forEach((event) => {
    if (!event.start) return;
    const iso = toLocalISODate(event.start);
    if (!next[iso]) next[iso] = [];
    next[iso] = [
      ...next[iso],
      { label: event.title, color: MEETING_SOURCE.color, variant: MEETING_SOURCE.variant, meeting: true },
    ];
  });
  return next;
}

function toLocalISODate(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
