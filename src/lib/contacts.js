import { supabase } from "./supabaseClient";

export const CONTACT_TAGS = ["Client", "Supplier"];

export async function fetchContacts() {
  const { data, error } = await supabase.from("contacts").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createContact(fields) {
  const { data, error } = await supabase.from("contacts").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateContact(id, fields) {
  const { data, error } = await supabase.from("contacts").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteContact(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchClientsForLinking() {
  const { data, error } = await supabase.from("clients").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}
