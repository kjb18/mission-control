import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const SOURCES = [
  { table: "rfqs", label: "RFQ", color: "bg-amber-400" },
  { table: "quotations", label: "Quotation", color: "bg-sky-400" },
  { table: "purchase_orders", label: "PO", color: "bg-violet-400" },
  { table: "invoices", label: "Invoice", color: "bg-rose-400" },
];

export function useMonthEvents(year, month) {
  const [eventsByDate, setEventsByDate] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = new Date(year, month + 1, 0);
    const endISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

    async function load() {
      setLoading(true);
      const results = await Promise.all(
        SOURCES.map(({ table }) =>
          supabase
            .from(table)
            .select("id, closing_date")
            .gte("closing_date", start)
            .lte("closing_date", endISO)
        )
      );

      if (cancelled) return;

      const map = {};
      results.forEach((res, idx) => {
        const { label, color } = SOURCES[idx];
        (res.data ?? []).forEach((row) => {
          if (!row.closing_date) return;
          if (!map[row.closing_date]) map[row.closing_date] = [];
          map[row.closing_date].push({ label, color });
        });
      });

      setEventsByDate(map);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  return { eventsByDate, loading };
}
