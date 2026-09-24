import { supabase } from "./supabaseClient";

export const BREWING_CATEGORIES = ["Internal", "Growth", "BD", "Admin"];
export const BREWING_STATUSES = ["Active", "Planning", "Draft", "Scheduled", "Idea"];

export async function fetchBrewingItems({ limit } = {}) {
  let query = supabase.from("brewing_items").select("*").order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createBrewingItem(fields) {
  const { data, error } = await supabase.from("brewing_items").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateBrewingItem(id, fields) {
  const { data, error } = await supabase.from("brewing_items").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBrewingItem(id) {
  const { error } = await supabase.from("brewing_items").delete().eq("id", id);
  if (error) throw error;
}
