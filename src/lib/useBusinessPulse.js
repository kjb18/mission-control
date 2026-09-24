import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export function useBusinessPulse() {
  const [stats, setStats] = useState({
    rfqsUnanswered: null,
    posUndelivered: null,
    pendingPayment: null,
    completedThisYear: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const yearEnd = `${new Date().getFullYear()}-12-31`;

      const [rfqs, pos, invoices, completed] = await Promise.all([
        supabase
          .from("rfqs")
          .select("id", { count: "exact", head: true })
          // "Unanswered" = no quote sent to the client yet — covers every
          // stage before quoting, not just the original "open" status.
          .in("status", ["open", "intake_confirmed", "sourced"]),
        supabase
          .from("purchase_orders")
          .select("id", { count: "exact", head: true })
          .neq("status", "delivered"),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .in("status", ["unpaid", "pending"]),
        supabase
          .from("purchase_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("closing_date", yearStart)
          .lte("closing_date", yearEnd),
      ]);

      if (!cancelled) {
        setStats({
          rfqsUnanswered: rfqs.count ?? 0,
          posUndelivered: pos.count ?? 0,
          pendingPayment: invoices.count ?? 0,
          completedThisYear: completed.count ?? 0,
        });
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading };
}
