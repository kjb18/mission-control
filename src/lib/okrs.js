import { supabase } from "./supabaseClient";

export async function fetchOkrs() {
  const { data, error } = await supabase
    .from("okrs")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createOkr(fields) {
  const { data, error } = await supabase.from("okrs").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateOkr(id, fields) {
  const { data, error } = await supabase.from("okrs").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteOkr(id) {
  const { error } = await supabase.from("okrs").delete().eq("id", id);
  if (error) throw error;
}

export function progressPercent(okr) {
  if (!okr.target_number) return 0;
  return Math.min(100, Math.round((Number(okr.current_count ?? 0) / Number(okr.target_number)) * 100));
}
