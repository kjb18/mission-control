import { supabase } from "./supabaseClient";

export async function parseRfqText(text) {
  return invoke({ input_type: "text", text });
}

export async function parseRfqFile(file) {
  const base64 = await fileToBase64(file);
  const input_type = file.type === "application/pdf" ? "pdf" : "image";
  return invoke({ input_type, file_base64: base64, media_type: file.type });
}

export async function matchOnly(parsed) {
  return invoke({ mode: "match_only", parsed });
}

async function invoke(body) {
  const { data, error } = await supabase.functions.invoke("parse-rfq", { body });
  if (error) throw new Error(error.message ?? "parse-rfq failed");
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.slice(result.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
