import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSXImport from "xlsx-js-style";
const XLSX: any = (XLSXImport as any).default ?? XLSXImport;
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo";

type DocKind = "devis" | "bl" | "facture";

const BRAND = {
  name: "Shape And Print",
  tagline: "Solutions d'impression sur mesure",
  legalName: "Malek Ayari",
  taxId: "1600084T",
  phone: "53 964 674",
  email: "shapeandprint@gmail.com",
};

function decodeBase64(b64: string): Uint8Array {
  // Worker-safe base64 decoder (no Buffer dependency)
  const bin = typeof atob === "function"
    ? atob(b64)
    : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fmtMoney(n: number) {
  return `${Number.isFinite(n) ? n.toFixed(3) : "0.000"} DT`;
}

function text(value: unknown, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  const str = String(value);
  return str.length > 0 ? str : fallback;
}

async function buildPdf(opts: {
  kind: DocKind;
  number: string;
  commande: any;
  client: any;
  totals: { ht: number; tvaRate: number; tva: number; ttc: number; discountRate?: number; discountHt?: number; htNet?: number; tvaNet?: number; timbreFiscal?: number };
}) {
  const { kind, number, commande, client, totals } = opts;
  const titleByKind: Record<DocKind, string> = {
    devis: "DEVIS",
    bl: "BON DE LIVRAISON",
    facture: "FACTURE",
  };
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;
  const primary = rgb(0.13, 0.16, 0.22);
  const muted = rgb(0.45, 0.5, 0.55);
  const line = rgb(0.85, 0.87, 0.9);

  // Header band with logo
  page.drawRectangle({ x: 0, y: y - 80, width, height: 90, color: rgb(0.96, 0.97, 0.99) });
  let textX = margin;
  try {
    const logoImg = await pdf.embedPng(decodeBase64(BRAND_LOGO_PNG_BASE64));
    const logoH = 56;
    const logoW = (logoImg.width / logoImg.height) * logoH;
    page.drawImage(logoImg, { x: margin, y: y - 68, width: logoW, height: logoH });
    textX = margin + logoW + 14;
  } catch (_e) {
    // Logo missing — fall back to text-only header
  }
  page.drawText(BRAND.name, { x: textX, y: y - 20, size: 18, font: bold, color: primary });
  page.drawText(`${BRAND.legalName}  ·  MF : ${BRAND.taxId}`, {
    x: textX, y: y - 38, size: 9, font, color: muted,
  });
  page.drawText(`Tél : ${BRAND.phone}  ·  ${BRAND.email}`, {
    x: textX, y: y - 52, size: 9, font, color: muted,
  });

  // Doc title block
  const titleStr = titleByKind[kind];
  const tw = bold.widthOfTextAtSize(titleStr, 20);
  page.drawText(titleStr, { x: width - margin - tw, y: y - 22, size: 20, font: bold, color: primary });
  const numStr = `N° ${text(number)}`;
  const nw = font.widthOfTextAtSize(numStr, 10);
  page.drawText(numStr, { x: width - margin - nw, y: y - 38, size: 10, font, color: muted });
  const dateStr = new Date().toLocaleDateString("fr-FR");
  const dw = font.widthOfTextAtSize(dateStr, 10);
  page.drawText(`Date : ${dateStr}`, { x: width - margin - dw - 30, y: y - 52, size: 10, font, color: muted });

  y -= 120;

  // Client block
  page.drawText("CLIENT", { x: margin, y, size: 9, font: bold, color: muted });
  y -= 14;
  const clientLines = [
    client?.full_name,
    client?.company_name,
    client?.phone ? `Tél : ${client.phone}` : null,
    client?.email,
    [client?.postal_code, client?.city].filter(Boolean).join(" "),
    client?.address,
    kind === "facture" && client?.client_type === "entreprise" && client?.tax_id
      ? `MF : ${client.tax_id}`
      : null,
  ].filter(Boolean).map((line) => text(line)) as string[];
  for (const l of clientLines) {
    page.drawText(text(l), { x: margin, y, size: 10, font, color: primary });
    y -= 13;
  }

  y -= 20;

  // Table header
  const cols = [
    { x: margin, w: 230, label: "Désignation" },
    { x: margin + 230, w: 70, label: "Qté", align: "right" as const },
    { x: margin + 300, w: 90, label: "P.U. HT", align: "right" as const },
    { x: margin + 390, w: 125, label: "Total HT", align: "right" as const },
  ];
  page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 20, color: rgb(0.97, 0.98, 1) });
  for (const c of cols) {
    const label = c.label;
    if (c.align === "right") {
      const w = bold.widthOfTextAtSize(label, 9);
      page.drawText(label, { x: c.x + c.w - w - 6, y: y + 4, size: 9, font: bold, color: primary });
    } else {
      page.drawText(label, { x: c.x + 6, y: y + 4, size: 9, font: bold, color: primary });
    }
  }
  y -= 22;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, color: line, thickness: 0.5 });
  y -= 14;

  const wrap = (value: unknown, max: number) => {
    const words = text(value, "Commande").split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(t, 9) > max) { if (cur) lines.push(cur); cur = w; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const drawRight = (txt: string, col: typeof cols[number], yy: number) => {
    const w = font.widthOfTextAtSize(txt, 9);
    page.drawText(txt, { x: col.x + col.w - w - 6, y: yy, size: 9, font, color: primary });
  };

  const items: any[] = (commande?.commande_items && commande.commande_items.length > 0)
    ? commande.commande_items
    : [{
        designation: commande?.description ?? "Commande",
        dimension: commande?.height_cm && commande?.width_cm ? `${commande.height_cm} x ${commande.width_cm} cm` : (commande?.size_label ?? null),
        quantity: commande?.quantity ?? 1,
        unit_price: commande?.unit_price ?? 0,
        total_ht: commande?.total_price,
        order_types: commande?.order_types,
      }];

  for (const it of items) {
    const designation = [
      it.order_types?.name ?? commande?.order_types?.name,
      it.designation,
      it.dimension ? `Dim: ${it.dimension}` : null,
      it.color ? `Couleur: ${it.color}` : null,
    ].filter(Boolean).join(" — ") || "Produit";
    const desLines = wrap(designation, 220);
    for (let i = 0; i < desLines.length; i++) {
      page.drawText(desLines[i], { x: margin + 6, y: y - i * 12, size: 9, font, color: primary });
    }
    const qty = String(it.quantity ?? 1);
    const pu = Number(it.unit_price ?? 0);
    const totHt = Number(it.total_ht ?? pu * Number(it.quantity ?? 1));
    drawRight(qty, cols[1], y);
    drawRight(fmtMoney(pu), cols[2], y);
    drawRight(fmtMoney(totHt), cols[3], y);
    y -= Math.max(20, desLines.length * 12 + 8);
  }

  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, color: line, thickness: 0.5 });
  y -= 24;

  // Totals (only for devis & facture)
  if (kind !== "bl") {
    const boxX = width - margin - 220;
    const rowH = 18;
    const dr = Number(totals.discountRate ?? 0);
    const timbre = kind === "facture" && client?.client_type === "entreprise" ? (totals.timbreFiscal ?? 1) : 0;
    const rows: [string, string][] = [];
    if (dr > 0) {
      const htBrut = totals.ht;
      const dHt = totals.discountHt ?? +(htBrut * (dr / 100)).toFixed(3);
      const htNet = totals.htNet ?? +(htBrut - dHt).toFixed(3);
      rows.push(["Total HT (brut)", fmtMoney(htBrut)]);
      rows.push([`Remise (${dr}%)`, "-" + fmtMoney(dHt)]);
      rows.push(["Total HT net", fmtMoney(htNet)]);
      rows.push([`TVA (${totals.tvaRate}%)`, fmtMoney(totals.tvaNet ?? totals.tva)]);
      if (timbre > 0) rows.push(["Timbre Fiscal", fmtMoney(timbre)]);
      rows.push(["Total TTC", fmtMoney(totals.ttc + timbre)]);
    } else {
      rows.push(["Total HT", fmtMoney(totals.ht)]);
      rows.push([`TVA (${totals.tvaRate}%)`, fmtMoney(totals.tva)]);
      if (timbre > 0) rows.push(["Timbre Fiscal", fmtMoney(timbre)]);
      rows.push(["Total TTC", fmtMoney(totals.ttc + timbre)]);
    }
    for (let i = 0; i < rows.length; i++) {
      const [lbl, val] = rows[i];
      const isLast = i === rows.length - 1;
      if (isLast) {
        page.drawRectangle({ x: boxX, y: y - 4, width: 220, height: rowH, color: rgb(0.13, 0.16, 0.22) });
      }
      const f = isLast ? bold : font;
      const c = isLast ? rgb(1, 1, 1) : primary;
      page.drawText(lbl, { x: boxX + 8, y: y + 2, size: 10, font: f, color: c });
      const w = f.widthOfTextAtSize(val, 10);
      page.drawText(val, { x: boxX + 220 - w - 8, y: y + 2, size: 10, font: f, color: c });
      y -= rowH;
    }
  } else {
    // BL: show HT, TVA, TTC, Livraison and grand total in a totals box (same style as devis/facture)
    const dr = Number(totals.discountRate ?? 0);
    const livraison = 7;
    const rows: Array<[string, string]> = [];
    if (dr > 0) {
      const htBrut = totals.ht;
      const dHt = totals.discountHt ?? +(htBrut * (dr / 100)).toFixed(3);
      const htNet = totals.htNet ?? +(htBrut - dHt).toFixed(3);
      rows.push(["Total HT (brut)", fmtMoney(htBrut)]);
      rows.push([`Remise (${dr}%)`, "-" + fmtMoney(dHt)]);
      rows.push(["Total HT net", fmtMoney(htNet)]);
      rows.push([`TVA (${totals.tvaRate}%)`, fmtMoney(totals.tvaNet ?? totals.tva)]);
      rows.push(["Total TTC", fmtMoney(totals.ttc)]);
    } else {
      rows.push(["Total HT", fmtMoney(totals.ht)]);
      rows.push([`TVA (${totals.tvaRate}%)`, fmtMoney(totals.tva)]);
      rows.push(["Total TTC", fmtMoney(totals.ttc)]);
    }
    rows.push(["Livraison", fmtMoney(livraison)]);
    rows.push(["Total à payer", fmtMoney(+(totals.ttc + livraison).toFixed(3))]);

    const boxX = width - margin - 220;
    const rowH = 18;
    for (let i = 0; i < rows.length; i++) {
      const [lbl, val] = rows[i];
      const isLast = i === rows.length - 1;
      const f = isLast ? bold : font;
      if (isLast) {
        page.drawRectangle({ x: boxX, y: y - 4, width: 220, height: rowH, color: rgb(0.13, 0.16, 0.22) });
      }
      const c = isLast ? rgb(1, 1, 1) : primary;
      page.drawText(lbl, { x: boxX + 8, y: y + 2, size: 10, font: f, color: c });
      const w = f.widthOfTextAtSize(val, 10);
      page.drawText(val, { x: boxX + 220 - w - 8, y: y + 2, size: 10, font: f, color: c });
      y -= rowH;
    }
    y -= 10;
    page.drawText("Reçu en bon état :", { x: margin, y, size: 10, font, color: primary });
    page.drawText("Signature client", { x: width - margin - 200, y, size: 10, font: bold, color: primary });
    page.drawLine({
      start: { x: width - margin - 200, y: y - 50 },
      end: { x: width - margin, y: y - 50 },
      color: line, thickness: 0.5,
    });
    y -= 80;
  }

  // Footer
  page.drawLine({ start: { x: margin, y: 60 }, end: { x: width - margin, y: 60 }, color: line, thickness: 0.5 });
  const footer = `${BRAND.name} · ${BRAND.legalName} · MF ${BRAND.taxId} · Tél ${BRAND.phone}`;
  const fw = font.widthOfTextAtSize(footer, 8);
  page.drawText(footer, { x: (width - fw) / 2, y: 46, size: 8, font, color: muted });

  return await pdf.save();
}

async function fetchCommande(supabase: any, commandeId: string) {
  const { data, error } = await supabase
    .from("commandes")
    .select("*, clients(*), order_types(name), commande_items(*, order_types(name))")
    .eq("id", commandeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Commande introuvable");
  return data;
}

function computeTotals(commande: any, tvaRate: number) {
  // Compute gross HT from items if available; otherwise from total_price (which may be post-discount)
  const items: any[] = Array.isArray(commande?.commande_items) ? commande.commande_items : [];
  const effectiveRate = Number(commande?.tva_rate ?? tvaRate);
  const dr = Math.max(0, Math.min(100, Number(commande?.discount_rate ?? 0)));
  let htGross: number;
  let tvaGross: number;
  if (items.length > 0) {
    htGross = +items.reduce((s, it) => s + Number(it.total_ht ?? 0), 0).toFixed(3);
    tvaGross = +items.reduce((s, it) => s + Number(it.tva_amount ?? 0), 0).toFixed(3);
  } else {
    // Fallback: stored values are already net of discount — reverse for display
    const storedHt = Number(commande?.total_price ?? Number(commande?.unit_price ?? 0) * Number(commande?.quantity ?? 1));
    const storedTva = commande?.tva_amount == null ? +(storedHt * (effectiveRate / 100)).toFixed(3) : Number(commande.tva_amount);
    const factor = dr > 0 ? (1 - dr / 100) : 1;
    htGross = +(storedHt / (factor || 1)).toFixed(3);
    tvaGross = +(storedTva / (factor || 1)).toFixed(3);
  }
  const htNet = +(htGross * (1 - dr / 100)).toFixed(3);
  const tvaNet = +(tvaGross * (1 - dr / 100)).toFixed(3);
  const ttc = +(htNet + tvaNet).toFixed(3);
  return {
    ht: htGross,
    tvaRate: effectiveRate,
    tva: tvaGross,
    ttc,
    discountRate: dr,
    discountHt: +(htGross - htNet).toFixed(3),
    htNet,
    tvaNet,
  };
}

const docInput = z.object({ commandeId: z.string().uuid(), tvaRate: z.number().optional() });

async function generateAndStore(
  supabase: any,
  userId: string,
  kind: DocKind,
  commandeId: string,
  tvaRate: number,
) {
  try {
  const commande = await fetchCommande(supabase, commandeId);
  const totals = computeTotals(commande, tvaRate);
  const timbreFiscal = kind === "facture" && commande.clients?.client_type === "entreprise" ? 1 : 0;
  (totals as any).timbreFiscal = timbreFiscal;
  const tableName = kind === "devis" ? "devis" : kind === "bl" ? "bons_livraison" : "factures";
  // Insert empty row first to get number, then build PDF and update
  const { data: row, error: insErr } = await supabase
    .from(tableName)
    .insert({
      commande_id: commande.id,
      client_id: commande.client_id,
      storage_path: "pending",
      discount_rate: totals.discountRate,
      ...(kind !== "bl" ? { total_ht: totals.htNet, total_ttc: totals.ttc + timbreFiscal, tva_rate: totals.tvaRate } : { total_ttc: totals.ttc + timbreFiscal }),
      created_by: userId,
    })
    .select("id, number")
    .single();
  if (insErr) throw insErr;

  const bytes = await buildPdf({
    kind,
    number: row.number,
    commande,
    client: commande.clients,
    totals,
  });
  const path = `${kind}/${row.number}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;

  const { error: updErr } = await supabase
    .from(tableName)
    .update({ storage_path: path })
    .eq("id", row.id);
  if (updErr) throw updErr;

  return { id: row.id, number: row.number, path };
  } catch (e: any) {
    console.error("[generateAndStore]", kind, commandeId, e?.stack || e?.message || e);
    throw new Error(`PDF ${kind} échec: ${e?.message || String(e)}`);
  }
}

export const generateDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => docInput.parse(d))
  .handler(async ({ data, context }) => {
    return generateAndStore(context.supabase, context.userId, "devis", data.commandeId, data.tvaRate ?? 19);
  });

export const generateBL = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => docInput.parse(d))
  .handler(async ({ data, context }) => {
    return generateAndStore(context.supabase, context.userId, "bl", data.commandeId, data.tvaRate ?? 19);
  });

export const generateFacture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => docInput.parse(d))
  .handler(async ({ data, context }) => {
    return generateAndStore(context.supabase, context.userId, "facture", data.commandeId, data.tvaRate ?? 19);
  });

/* ============================ STANDALONE DEVIS ============================ */

const standaloneItemSchema = z.object({
  designation: z.string().min(1),
  type_name: z.string().optional().nullable(),
  dimension: z.string().optional().nullable(),
  quantity: z.number().min(1),
  unit_price: z.number(),
  color: z.string().optional().nullable(),
});
const standaloneDevisInput = z.object({
  clientId: z.string().uuid(),
  tvaRate: z.number().optional(),
  comment: z.string().optional().nullable(),
  items: z.array(standaloneItemSchema).min(1),
  devisId: z.string().uuid().optional(), // when set: regenerate (edit)
});

function computeStandaloneTotals(items: z.infer<typeof standaloneItemSchema>[], tvaRate: number) {
  let ht = 0;
  for (const it of items) {
    const isDtf = (it.type_name ?? "").toLowerCase().includes("dtf");
    const dimNum = parseFloat(String(it.dimension ?? "").replace(",", "."));
    const lineHt = isDtf && !Number.isNaN(dimNum)
      ? +(dimNum * it.quantity * it.unit_price).toFixed(3)
      : +(it.quantity * it.unit_price).toFixed(3);
    ht += lineHt;
  }
  ht = +ht.toFixed(3);
  const tva = +(ht * (tvaRate / 100)).toFixed(3);
  const ttc = +(ht + tva).toFixed(3);
  return { ht, tvaRate, tva, ttc };
}

export const createStandaloneDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => standaloneDevisInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tvaRate = data.tvaRate ?? 19;
    const totals = computeStandaloneTotals(data.items, tvaRate);

    // Fetch client for PDF rendering
    const { data: client, error: cErr } = await supabase
      .from("clients").select("*").eq("id", data.clientId).single();
    if (cErr || !client) throw new Error("Client introuvable");

    // Build a "virtual commande" passed to buildPdf
    const virtualCommande = {
      number: null,
      description: data.comment ?? null,
      commande_items: data.items.map((it) => ({
        designation: it.designation,
        dimension: it.dimension ?? "",
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_ht: (() => {
          const isDtf = (it.type_name ?? "").toLowerCase().includes("dtf");
          const dimNum = parseFloat(String(it.dimension ?? "").replace(",", "."));
          return isDtf && !Number.isNaN(dimNum)
            ? +(dimNum * it.quantity * it.unit_price).toFixed(3)
            : +(it.quantity * it.unit_price).toFixed(3);
        })(),
        order_types: it.type_name ? { name: it.type_name } : null,
        color: it.color ?? null,
      })),
    };

    let row: { id: string; number: string | null };
    if (data.devisId) {
      const { data: existing, error } = await supabase
        .from("devis")
        .update({
          client_id: data.clientId,
          total_ht: totals.ht,
          total_ttc: totals.ttc,
          tva_rate: totals.tvaRate,
          items: data.items as any,
          comment: data.comment ?? null,
        } as any)
        .eq("id", data.devisId)
        .select("id, number")
        .single();
      if (error || !existing) throw error ?? new Error("Devis introuvable");
      row = existing;
    } else {
      const { data: inserted, error } = await supabase
        .from("devis")
        .insert({
          commande_id: null,
          client_id: data.clientId,
          storage_path: "pending",
          total_ht: totals.ht,
          total_ttc: totals.ttc,
          tva_rate: totals.tvaRate,
          items: data.items as any,
          comment: data.comment ?? null,
          created_by: userId,
        } as any)
        .select("id, number")
        .single();
      if (error || !inserted) throw error ?? new Error("Création devis échouée");
      row = inserted;
    }

    const bytes = await buildPdf({
      kind: "devis",
      number: row.number ?? "",
      commande: virtualCommande,
      client,
      totals,
    });
    const path = `devis/${row.number ?? "sans-numero"}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;
    const { error: updErr } = await supabase
      .from("devis").update({ storage_path: path }).eq("id", row.id);
    if (updErr) throw updErr;

    return { id: row.id, number: row.number ?? "", path };
  });

export const getStandaloneDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ devisId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("devis")
      .select("id, number, client_id, total_ht, total_ttc, tva_rate, storage_path, commande_id, items, comment")
      .eq("id", data.devisId)
      .single();
    if (error || !row) throw error ?? new Error("Devis introuvable");
    return row;
  });

/* ============================ EXCEL CLIENT (DTF + Autres) ============================ */

export type DtfRow = {
  date: string;
  number?: string;
  designation: string;
  dimension: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
};
export type OtherRow = {
  date: string;
  number?: string;
  type?: string;
  designation: string;
  dimension: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
};
export type DtfAdvance = { date: string; amount: number; payment_type: string };

function buildClientWorkbook(
  client: any,
  rows: DtfRow[],
  otherRows: OtherRow[],
  advances: DtfAdvance[],
) {
  const wb = XLSX.utils.book_new();

  // ----- Onglet DTF -----
  const dtfData: any[][] = [];
  dtfData.push([`Fichier DTF — ${client?.full_name ?? ""}`]);
  dtfData.push([client?.company_name ?? "", "", "", "", "", "", "", new Date().toLocaleDateString("fr-FR")]);
  dtfData.push([]);
  dtfData.push(["Commandes DTF"]);
  dtfData.push(["Date", "N° Commande", "Désignation", "Dimension (ML)", "Quantité", "ML total", "Prix unitaire", "Prix Total"]);
  const startRow = dtfData.length + 1;
  rows.forEach((r, i) => {
    const rIdx = startRow + i;
    const dimNum = parseFloat(String(r.dimension ?? "").replace(",", "."));
    const mlTotal = Number.isNaN(dimNum) ? r.quantity : +(dimNum * r.quantity).toFixed(3);
    const total = r.total_price != null ? Number(r.total_price) : { f: `F${rIdx}*G${rIdx}` };
    dtfData.push([
      r.date,
      r.number ?? "",
      r.designation,
      r.dimension ?? "",
      r.quantity,
      mlTotal,
      r.unit_price,
      total,
    ]);
  });
  const endRow = startRow + rows.length - 1;
  dtfData.push([]);
  const totalCmdRow = dtfData.length + 1;
  dtfData.push(["", "", "", "", "", "", "Total commandes", { f: rows.length ? `SUM(H${startRow}:H${endRow})` : 0 }]);
  dtfData.push([]);
  dtfData.push(["Avances"]);
  dtfData.push(["Date", "Montant", "Type paiement"]);
  const advStart = dtfData.length + 1;
  advances.forEach((a) => dtfData.push([a.date, a.amount, a.payment_type]));
  const advEnd = advStart + advances.length - 1;
  dtfData.push([]);
  const totalAdvRow = dtfData.length + 1;
  dtfData.push(["", "Total avances", { f: advances.length ? `SUM(B${advStart}:B${advEnd})` : 0 }]);
  dtfData.push(["", "Reste à payer", { f: `H${totalCmdRow}-C${totalAdvRow}` }]);

  const wsDtf = XLSX.utils.aoa_to_sheet(dtfData);
  wsDtf["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 14 },
  ];
  const setBold = (ws: any, addr: string) => { if (ws[addr]) ws[addr].s = { font: { bold: true } }; };
  ["A1", "A4", "A5", "B5", "C5", "D5", "E5", "F5", "G5", "H5"].forEach((a) => setBold(wsDtf, a));
  XLSX.utils.book_append_sheet(wb, wsDtf, "DTF");

  // ----- Onglet Autres commandes -----
  const oData: any[][] = [];
  oData.push([`Autres commandes — ${client?.full_name ?? ""}`]);
  oData.push([]);
  oData.push(["Date", "N° Commande", "Type", "Désignation", "Taille", "Quantité", "Prix unitaire", "Prix Total"]);
  const oStart = oData.length + 1;
  otherRows.forEach((r, i) => {
    const rIdx = oStart + i;
    const total = r.total_price != null ? Number(r.total_price) : { f: `F${rIdx}*G${rIdx}` };
    oData.push([
      r.date,
      r.number ?? "",
      r.type ?? "",
      r.designation,
      r.dimension ?? "",
      r.quantity,
      r.unit_price,
      total,
    ]);
  });
  const oEnd = oStart + otherRows.length - 1;
  oData.push([]);
  oData.push(["", "", "", "", "", "", "Total", { f: otherRows.length ? `SUM(H${oStart}:H${oEnd})` : 0 }]);
  const wsO = XLSX.utils.aoa_to_sheet(oData);
  wsO["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
  ];
  ["A1", "A3", "B3", "C3", "D3", "E3", "F3", "G3", "H3"].forEach((a) => setBold(wsO, a));
  XLSX.utils.book_append_sheet(wb, wsO, "Autres commandes");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(buf as ArrayBuffer);
}

async function ensureClientFileRecord(supabase: any, clientId: string) {
  const { data, error } = await supabase
    .from("client_dtf_files")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function regenerateClientFile(
  supabase: any,
  clientId: string,
  rows: DtfRow[],
  otherRows: OtherRow[],
  advances: DtfAdvance[],
) {
  const { data: client, error: cErr } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (cErr) throw cErr;
  const bytes = buildClientWorkbook(client, rows, otherRows, advances);
  const path = `${clientId}/commandes.xlsx`;
  const { error: upErr } = await supabase.storage
    .from("dtf-excel")
    .upload(path, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
  if (upErr) throw upErr;

  const existing = await ensureClientFileRecord(supabase, clientId);
  if (existing) {
    const { error } = await supabase
      .from("client_dtf_files")
      .update({ rows, other_rows: otherRows, advances, storage_path: path })
      .eq("client_id", clientId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("client_dtf_files")
      .insert({ client_id: clientId, rows, other_rows: otherRows, advances, storage_path: path });
    if (error) throw error;
  }
  return { path };
}

function itemsToRows(cmd: any): { dtf: DtfRow[]; other: OtherRow[] } {
  const date = (cmd.created_at ? new Date(cmd.created_at) : new Date()).toISOString().slice(0, 10);
  const items = (cmd.commande_items ?? []) as any[];
  const dtf: DtfRow[] = [];
  const other: OtherRow[] = [];
  for (const it of items) {
    const typeName = it.order_types?.name ?? cmd.order_types?.name ?? "";
    const isDtf = typeName.toLowerCase().includes("dtf");
    const qty = Number(it.quantity ?? 1);
    const pu = Number(it.unit_price ?? 0);
    const dimNum = parseFloat(String(it.dimension ?? "").replace(",", "."));
    const fallback = isDtf
      ? (Number.isNaN(dimNum) ? 0 : +(dimNum * qty * pu).toFixed(3))
      : +(qty * pu).toFixed(3);
    const base = {
      date,
      number: cmd.number,
      designation: it.designation || cmd.description || "Commande",
      dimension: it.dimension ?? "",
      quantity: qty,
      unit_price: pu,
      total_price: Number(it.total_ht ?? fallback),
    };
    if (isDtf) dtf.push(base);
    else other.push({ ...base, type: typeName });
  }
  return { dtf, other };
}

export const appendCommandeToClientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ commandeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const cmd = await fetchCommande(context.supabase, data.commandeId);
    const existing = await ensureClientFileRecord(context.supabase, cmd.client_id);
    const rows: DtfRow[] = (existing?.rows as DtfRow[]) ?? [];
    const otherRows: OtherRow[] = (existing?.other_rows as OtherRow[]) ?? [];
    const advances: DtfAdvance[] = (existing?.advances as DtfAdvance[]) ?? [];
    // Retire d'éventuelles lignes existantes pour ce numéro (re-append idempotent)
    const filteredDtf = rows.filter((r) => r.number !== cmd.number);
    const filteredOther = otherRows.filter((r) => r.number !== cmd.number);
    const { dtf, other } = itemsToRows(cmd);
    return regenerateClientFile(
      context.supabase,
      cmd.client_id,
      [...filteredDtf, ...dtf],
      [...filteredOther, ...other],
      advances,
    );
  });

// Conserve le nom historique pour compat avec le bouton existant
export const appendDtfFromCommande = appendCommandeToClientFile;

export const addDtfAdvance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      date: z.string(),
      amount: z.number(),
      payment_type: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const existing = await ensureClientFileRecord(context.supabase, data.clientId);
    const rows: DtfRow[] = (existing?.rows as DtfRow[]) ?? [];
    const otherRows: OtherRow[] = (existing?.other_rows as OtherRow[]) ?? [];
    const advances: DtfAdvance[] = (existing?.advances as DtfAdvance[]) ?? [];
    advances.push({ date: data.date, amount: data.amount, payment_type: data.payment_type });
    return regenerateClientFile(context.supabase, data.clientId, rows, otherRows, advances);
  });

export const updateDtf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      rows: z.array(z.any()),
      otherRows: z.array(z.any()).optional(),
      advances: z.array(z.any()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const existing = await ensureClientFileRecord(context.supabase, data.clientId);
    const otherRows = (data.otherRows ?? (existing?.other_rows as OtherRow[]) ?? []) as OtherRow[];
    return regenerateClientFile(
      context.supabase,
      data.clientId,
      data.rows as DtfRow[],
      otherRows,
      data.advances as DtfAdvance[],
    );
  });