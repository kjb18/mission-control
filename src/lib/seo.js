import { supabase } from "./supabaseClient";

export const SEO_STATUSES = ["Draft", "Scheduled", "Published"];

export async function fetchArticles() {
  const { data, error } = await supabase.from("seo_articles").select("*");
  if (error) throw error;
  return data ?? [];
}

/**
 * Keeps the "SEO articles" OKR's current_count in sync with the number of
 * Published articles here, so the two surfaces stay genuinely consistent
 * rather than just visually similar.
 */
async function syncSeoOkr() {
  const { count } = await supabase
    .from("seo_articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "Published");
  await supabase.from("okrs").update({ current_count: count ?? 0 }).eq("objective", "SEO articles");
}

export async function createArticle(fields) {
  const { data, error } = await supabase.from("seo_articles").insert(fields).select().single();
  if (error) throw error;
  await syncSeoOkr();
  return data;
}

export async function updateArticle(id, fields) {
  const { data, error } = await supabase.from("seo_articles").update(fields).eq("id", id).select().single();
  if (error) throw error;
  await syncSeoOkr();
  return data;
}

export async function deleteArticle(id) {
  const { error } = await supabase.from("seo_articles").delete().eq("id", id);
  if (error) throw error;
  await syncSeoOkr();
}

export async function fetchSeoTarget() {
  const { data } = await supabase
    .from("okrs")
    .select("target_number")
    .eq("objective", "SEO articles")
    .maybeSingle();
  return data?.target_number ?? 50;
}
