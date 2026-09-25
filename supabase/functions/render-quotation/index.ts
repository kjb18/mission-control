// Supabase Edge Function: render-quotation
//
// Generates a branded Ultra Power quotation PDF from the exact data the
// user approved in Quote Builder (WYSIWYG — no recomputation happens
// here), uploads it to the private `quotations` storage bucket, and
// returns a signed URL for preview/download/email.
//
// Uses pdf-lib, not pdfkit — pdfkit's bundled standard-font metrics are
// loaded via fs reads relative to __dirname, which is a known break point
// in Deno's npm compatibility layer. pdf-lib embeds its standard fonts as
// plain data with zero filesystem/native dependencies, which is why it's
// the library Supabase's own Edge Function PDF examples use. Puppeteer
// (the task's other named option) isn't viable at all here — Edge
// Functions have no Chromium binary available to launch.
//
// Requires these Edge Function secrets/env (SUPABASE_* are auto-provided):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { requireOwner, unauthorized } from "../_shared/auth.ts";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const NAVY = rgb(15 / 255, 23 / 255, 42 / 255);
const TEAL = rgb(20 / 255, 184 / 255, 166 / 255);
const LIGHT_GRAY = rgb(243 / 255, 244 / 255, 246 / 255);
const MID_GRAY = rgb(0.75, 0.75, 0.75);
const BLACK = rgb(0.05, 0.05, 0.05);
const WHITE = rgb(1, 1, 1);

const COLS = [
  { key: "item_no", label: "#", x: MARGIN, width: 28 },
  { key: "description", label: "Description", x: MARGIN + 28, width: 217 },
  { key: "quantity", label: "Qty", x: MARGIN + 245, width: 45 },
  { key: "unit", label: "Unit", x: MARGIN + 290, width: 45 },
  { key: "unit_price_php", label: "Unit Price (PHP)", x: MARGIN + 335, width: 80 },
  { key: "total_php", label: "Total (PHP)", x: MARGIN + 415, width: 80 },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function money(n: number) {
  return Number(n ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = String(text ?? "").split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function buildPdf(body: any) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fromTop = (yTop: number) => PAGE_HEIGHT - yTop;

  // --- Header: logo placeholder (left) + company name (right) ---
  page.drawRectangle({
    x: MARGIN,
    y: fromTop(90),
    width: 80,
    height: 40,
    color: LIGHT_GRAY,
    borderColor: MID_GRAY,
    borderWidth: 1,
  });
  page.drawText("LOGO", {
    x: MARGIN + 26,
    y: fromTop(74),
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const companyName = "Ultra Power Industrial Resources Inc";
  const companyNameWidth = bold.widthOfTextAtSize(companyName, 13);
  page.drawText(companyName, {
    x: PAGE_WIDTH - MARGIN - companyNameWidth,
    y: fromTop(65),
    size: 13,
    font: bold,
    color: NAVY,
  });

  // --- Divider ---
  page.drawLine({
    start: { x: MARGIN, y: fromTop(100) },
    end: { x: PAGE_WIDTH - MARGIN, y: fromTop(100) },
    thickness: 2,
    color: NAVY,
  });

  // --- Client address block ---
  let y = 122;
  page.drawText("To:", { x: MARGIN, y: fromTop(y), size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y += 14;
  page.drawText(body.client_name || "Client", { x: MARGIN, y: fromTop(y), size: 12, font: bold, color: BLACK });
  y += 15;
  for (const line of wrapText(body.client_address || "", font, 10, 260)) {
    if (!line) continue;
    page.drawText(line, { x: MARGIN, y: fromTop(y), size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    y += 13;
  }

  const dateLabel = `Date: ${body.date || new Date().toISOString().slice(0, 10)}`;
  const dateWidth = font.widthOfTextAtSize(dateLabel, 10);
  page.drawText(dateLabel, { x: PAGE_WIDTH - MARGIN - dateWidth, y: fromTop(122), size: 10, font, color: BLACK });

  // --- Subject bar (teal border) ---
  const subjectTop = y + 12;
  page.drawRectangle({
    x: MARGIN,
    y: fromTop(subjectTop + 24),
    width: CONTENT_WIDTH,
    height: 24,
    borderColor: TEAL,
    borderWidth: 1.5,
  });
  page.drawText(
    `Subject: Quotation for RFQ ${body.quote_number || body.rfq_id || ""}${
      body.closing_date ? `  ·  RFQ closing date: ${body.closing_date}` : ""
    }`,
    { x: MARGIN + 8, y: fromTop(subjectTop + 16), size: 10, font, color: NAVY }
  );

  // --- Items table ---
  let tableTop = subjectTop + 44;
  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: fromTop(tableTop + 22), width: CONTENT_WIDTH, height: 22, color: NAVY });
    for (const col of COLS) {
      page.drawText(col.label, {
        x: col.x + 4,
        y: fromTop(tableTop + 15),
        size: 9,
        font: bold,
        color: WHITE,
      });
    }
    tableTop += 22;
  };
  drawTableHeader();

  const rows = Array.isArray(body.lines) ? body.lines : [];
  for (const row of rows) {
    const descLines = wrapText(row.description, font, 9, COLS[1].width - 8);
    const rowHeight = Math.max(18, descLines.length * 11 + 6);

    if (tableTop + rowHeight > PAGE_HEIGHT - 220) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      tableTop = 50;
      drawTableHeader();
    }

    page.drawRectangle({
      x: MARGIN,
      y: fromTop(tableTop + rowHeight),
      width: CONTENT_WIDTH,
      height: rowHeight,
      borderColor: MID_GRAY,
      borderWidth: 0.5,
    });

    const cellY = fromTop(tableTop + 13);
    page.drawText(String(row.item_no ?? ""), { x: COLS[0].x + 4, y: cellY, size: 9, font, color: BLACK });
    descLines.forEach((line, i) => {
      page.drawText(line, { x: COLS[1].x + 4, y: fromTop(tableTop + 13 + i * 11), size: 9, font, color: BLACK });
    });
    page.drawText(String(row.quantity ?? ""), { x: COLS[2].x + 4, y: cellY, size: 9, font, color: BLACK });
    page.drawText(String(row.unit ?? ""), { x: COLS[3].x + 4, y: cellY, size: 9, font, color: BLACK });
    page.drawText(money(row.unit_price_php), { x: COLS[4].x + 4, y: cellY, size: 9, font, color: BLACK });
    page.drawText(money(row.total_php), { x: COLS[5].x + 4, y: cellY, size: 9, font, color: BLACK });

    tableTop += rowHeight;
  }

  // --- Totals (bold-bordered box, right-aligned) ---
  const totalsWidth = 230;
  const totalsX = PAGE_WIDTH - MARGIN - totalsWidth;
  let totalsTop = tableTop + 16;
  const totalsHeight = 66;
  page.drawRectangle({
    x: totalsX,
    y: fromTop(totalsTop + totalsHeight),
    width: totalsWidth,
    height: totalsHeight,
    borderColor: BLACK,
    borderWidth: 1.5,
  });

  const totalLine = (label: string, value: string, rowY: number, boldRow = false) => {
    page.drawText(label, { x: totalsX + 10, y: fromTop(rowY), size: 10, font: boldRow ? bold : font, color: BLACK });
    const w = (boldRow ? bold : font).widthOfTextAtSize(value, 10);
    page.drawText(value, {
      x: totalsX + totalsWidth - 10 - w,
      y: fromTop(rowY),
      size: 10,
      font: boldRow ? bold : font,
      color: BLACK,
    });
  };
  totalLine("Subtotal", `PHP ${money(body.subtotal)}`, totalsTop + 20);
  totalLine("VAT (12%)", `PHP ${money(body.vat)}`, totalsTop + 38);
  page.drawLine({
    start: { x: totalsX + 10, y: fromTop(totalsTop + 46) },
    end: { x: totalsX + totalsWidth - 10, y: fromTop(totalsTop + 46) },
    thickness: 0.75,
    color: MID_GRAY,
  });
  totalLine("Grand Total", `PHP ${money(body.grand_total)}`, totalsTop + 60, true);

  // --- Terms & conditions (light gray box) ---
  let termsTop = totalsTop + totalsHeight + 24;
  const terms = [
    "Terms & Conditions:",
    "1. This quotation is valid for 30 days from the date above.",
    "2. Prices are quoted in Philippine Peso (PHP) and are VAT inclusive.",
    "3. Payment terms: 50% down payment, 50% upon delivery, unless otherwise agreed in writing.",
    "4. Lead times are estimates provided by the supplier and begin upon receipt of down payment.",
    "5. Prices are subject to change after the validity period without prior notice.",
  ];
  const termsHeight = terms.length * 13 + 14;
  page.drawRectangle({
    x: MARGIN,
    y: fromTop(termsTop + termsHeight),
    width: CONTENT_WIDTH,
    height: termsHeight,
    color: LIGHT_GRAY,
  });
  terms.forEach((line, i) => {
    page.drawText(line, {
      x: MARGIN + 10,
      y: fromTop(termsTop + 16 + i * 13),
      size: i === 0 ? 9.5 : 9,
      font: i === 0 ? bold : font,
      color: rgb(0.25, 0.25, 0.25),
    });
  });

  // --- Signature block ---
  const sigTop = termsTop + termsHeight + 30;
  page.drawText("Prepared by,", { x: MARGIN, y: fromTop(sigTop), size: 10, font, color: BLACK });
  page.drawText("Khalil Joseph Banares", { x: MARGIN, y: fromTop(sigTop + 32), size: 11, font: bold, color: BLACK });
  page.drawText("Engineering Solutions Director", {
    x: MARGIN,
    y: fromTop(sigTop + 46),
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText("Ultra Power Industrial Resources Inc.", {
    x: MARGIN,
    y: fromTop(sigTop + 60),
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  return pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const user = await requireOwner(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const pdfBytes = await buildPdf(body);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const path = `${body.rfq_id || "unknown"}/${body.quote_number || "quote"}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("quotations")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const { data: signed, error: signError } = await supabase.storage
      .from("quotations")
      .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 days
    if (signError) throw signError;

    return new Response(JSON.stringify({ pdfUrl: signed.signedUrl, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Supabase's PostgrestError/StorageError (and similar) are plain objects
// with a `.message`, not `instanceof Error` — String(error) on those
// silently stringifies to "[object Object]" instead of anything useful.
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
