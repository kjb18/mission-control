import { supabase } from "./supabaseClient";

export const CONTENT_PLATFORMS = ["Website", "LinkedIn", "Instagram", "Email"];
export const CONTENT_STATUSES = ["Draft", "Scheduled", "Published"];

export async function fetchContentItems() {
  const { data, error } = await supabase.from("content_items").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function createContentItem(fields) {
  const { data, error } = await supabase.from("content_items").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateContentItem(id, fields) {
  const { data, error } = await supabase.from("content_items").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteContentItem(id) {
  const { error } = await supabase.from("content_items").delete().eq("id", id);
  if (error) throw error;
}
