import { supabase } from "./supabaseClient";

export async function fetchWins({ limit } = {}) {
  let query = supabase.from("wins").select("*").order("awarded_date", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export function computeWinsSummary(wins) {
  const thisYear = new Date().getFullYear();
  const winsThisYear = wins.filter((w) => w.awarded_date && new Date(w.awarded_date).getFullYear() === thisYear);
  return {
    totalCount: wins.length,
    totalValueThisYear: winsThisYear.reduce((sum, w) => sum + Number(w.total_value ?? 0), 0),
    countThisYear: winsThisYear.length,
  };
}
