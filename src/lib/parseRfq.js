import { supabase } from "./supabaseClient";

export async function parseRfqText(text) {
  return invoke({ input_type: "text", text });
}

export const RFQ_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

// Some systems hand over .heic files with an empty MIME type.
export function rfqFileType(file) {
  if (file.type) return file.type;
  return /\.hei[cf]$/i.test(file.name) ? "image/heic" : "";
}

export async function parseRfqFile(file) {
  let type = rfqFileType(file);
  // Claude's image blocks don't accept HEIC, so re-encode it as JPEG first.
  if (type === "image/heic") {
    file = await heicToJpeg(file);
    type = "image/jpeg";
  }
  const base64 = await fileToBase64(file);
  const input_type = type === "application/pdf" ? "pdf" : "image";
  return invoke({ input_type, file_base64: base64, media_type: type });
}

// Uses the browser's own decoder — Safari reads HEIC, Chrome and Firefox don't.
async function heicToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error();
    return new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
  } catch {
    throw new Error("This browser can't read HEIC images. Open it in Safari, or export it as JPEG or PNG.");
  } finally {
    URL.revokeObjectURL(url);
  }
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
