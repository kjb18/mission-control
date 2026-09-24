import { supabase } from "./supabaseClient";

export const DEFAULT_FX_RATE = 57.8;

export async function fetchFxRate() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("fx_rate")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data?.fx_rate ?? DEFAULT_FX_RATE;
}

export async function updateFxRate(fxRate) {
  const { error } = await supabase
    .from("app_settings")
    .update({ fx_rate: fxRate })
    .eq("id", true);
  if (error) throw error;
}
