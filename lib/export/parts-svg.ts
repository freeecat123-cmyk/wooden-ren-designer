/**
 * 零件輪廓 SVG 匯出 —— 把每個零件的「攤平切割面」輸出成乾淨的 mm 尺寸向量輪廓，
 * 供 CNC / 雷切 / 向量編輯用（直接餵進 designer.woodenren.com/cnc.html → G-code）。
 *
 * 兩種產出：
 *   1. partsSvgFiles(design)  → 每個零件（合併同形）一張輪廓 SVG，打包成 ZIP。
 *   2. nestedSheetSvg(design) → 所有零件輪廓自動排進板材（shelf packing），一張合併 SVG。
 *
 * 輪廓來源＝projectPartSilhouette（含所有造型：錐腳 / 弧肩斜腳 / 倒角 / 圓料 / 斜切…）。
 * 每個零件取「三主視圖（front/side/top）中投影面積最大者」＝攤平躺平的那一面。
 */
import type { FurnitureDesign, Part } from "@/lib/types";
import { projectPartSilhouette, type OrthoView } from "@/lib/render/geometry";
import { groupPartsForDrawing, groupDisplayName } from "@/lib/render/part-drawing/grouping";
import { zipStore } from "@/lib/export/zip-store";
import { partMachiningFaces, type MachiningFace } from "@/lib/export/mortise-faces";

export interface PartOutline {
  /** 攤平面輪廓點（mm，已平移到左上原點，Y 向下為正＝SVG 慣例） */
  pts: Array<{ x: number; y: number }>;
  /** 外框寬 / 高（mm） */
  w: number;
  h: number;
}

/** 把零件旋轉/位置歸零，只看它自身幾何（攤平在工作台上的形狀）。 */
function toLocalPart(part: Part): Part {
  return {
    ...part,
    rotation: { x: 0, y: 0, z: 0 },
    origin: { x: 0, y: 0, z: 0 },
  };
}

const PRINCIPAL_VIEWS: OrthoView[] = ["top", "front", "side"];

/** 取零件「攤平切割面」的 2D 輪廓（面積最大的主視圖）。 */
export function partFlatOutline(part: Part): PartOutline {
  const lp = toLocalPart(part);
  let best: { pts: Array<{ x: number; y: number }>; w: number; h: number } | null = null;
  let bestArea = -1;
  for (const view of PRINCIPAL_VIEWS) {
    const raw = projectPartSilhouette(lp, view);
    if (raw.length < 3) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of raw) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const area = w * h;
    if (area > bestArea && w > 0.01 && h > 0.01) {
      bestArea = area;
      // 平移到左上原點；projectPartSilhouette 的 Y 是「上為正」，SVG 要「下為正」→ 翻 Y。
      const pts = raw.map((p) => ({ x: p.x - minX, y: maxY - p.y }));
      best = { pts, w, h };
    }
  }
  if (!best) {
    // fallback：用外形尺寸畫矩形（極少數投影退化時）
    const w = part.visible.length;
    const h = part.visible.width;
    best = { pts: [ { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h } ], w, h };
  }
  return best;
}

/** 輪廓點 → SVG path d 字串（閉合）。 */
export function outlinePathD(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  const round = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${round(pts[0].x)} ${round(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${round(pts[i].x)} ${round(pts[i].y)}`;
  return d + " Z";
}

const MARGIN_MM = 5;
/** 切割線 stroke 寬（mm）。雷切慣例 0.1mm hairline。 */
const CUT_STROKE_MM = 0.1;

/** 單一零件輪廓 → 完整 SVG 字串（mm 尺度、viewBox 帶 margin、附零件 id/尺寸註記）。 */
export function partOutlineSvg(part: Part, opts?: { label?: string; qty?: number }): string {
  const { pts, w, h } = partFlatOutline(part);
  const vbW = w + MARGIN_MM * 2;
  const vbH = h + MARGIN_MM * 2;
  const shifted = pts.map((p) => ({ x: p.x + MARGIN_MM, y: p.y + MARGIN_MM }));
  const label = opts?.label ?? part.id;
  const qty = opts?.qty ?? 1;
  const title = `${label}${qty > 1 ? ` ×${qty}` : ""} — ${Math.round(w)}×${Math.round(h)}mm`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round1(vbW)}mm" height="${round1(vbH)}mm" viewBox="0 0 ${round1(vbW)} ${round1(vbH)}">`,
    `  <title>${escapeXml(title)}</title>`,
    `  <path d="${outlinePathD(shifted)}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"/>`,
    `</svg>`,
    "",
  ].join("\n");
}

/** 每個零件（合併同形）一張 SVG。回傳 { 檔名: svg 字串 }。 */
export function partsSvgFiles(design: FurnitureDesign): Record<string, string> {
  const groups = groupPartsForDrawing(design);
  const files: Record<string, string> = {};
  const used = new Set<string>();
  groups.forEach((g, i) => {
    const rep = g.representative;
    const code = `P-${String(i + 1).padStart(2, "0")}`;
    const name0 = groupDisplayName(g, "zh");
    const base = safeFileName(`${code}_${name0}`);
    let name = `${base}.svg`;
    let n = 2;
    while (used.has(name)) name = `${base}-${n++}.svg`;
    used.add(name);
    files[name] = partOutlineSvg(rep, { label: `${code} ${name0}`, qty: g.count });
  });
  return files;
}

// ---- 套料排版（shelf packing）：所有零件（依實際數量展開）排進板材，一張合併 SVG ----

const SHEET_GAP_MM = 8;
const DEFAULT_SHEET_WIDTH_MM = 1220; // 4x8 夾板短邊常見值

/** 把所有零件（實際數量）用 shelf packing 排成一張合併 SVG。 */
export function nestedSheetSvg(design: FurnitureDesign, sheetWidthMm = DEFAULT_SHEET_WIDTH_MM): string {
  const groups = groupPartsForDrawing(design);
  // 展開成每個實際零件一份，附輪廓
  const items: Array<{ label: string; outline: PartOutline }> = [];
  groups.forEach((g, i) => {
    const outline = partFlatOutline(g.representative);
    const label = `P-${String(i + 1).padStart(2, "0")}`;
    for (let k = 0; k < g.count; k++) items.push({ label, outline });
  });
  // 大件優先（面積遞減）較省料
  items.sort((a, b) => b.outline.w * b.outline.h - a.outline.w * a.outline.h);

  // shelf packing：由左至右排，超過 sheetWidth 換列
  let cursorX = SHEET_GAP_MM;
  let cursorY = SHEET_GAP_MM;
  let shelfH = 0;
  let sheetH = 0;
  const placed: Array<{ x: number; y: number; item: (typeof items)[number] }> = [];
  let maxRight = SHEET_GAP_MM; // 追蹤實際用到的最右邊界（含超寬件），避免 viewBox 裁切
  for (const it of items) {
    const pw = it.outline.w;
    const ph = it.outline.h;
    if (cursorX + pw + SHEET_GAP_MM > sheetWidthMm && cursorX > SHEET_GAP_MM) {
      // 換列
      cursorX = SHEET_GAP_MM;
      cursorY += shelfH + SHEET_GAP_MM;
      shelfH = 0;
    }
    placed.push({ x: cursorX, y: cursorY, item: it });
    cursorX += pw + SHEET_GAP_MM;
    if (cursorX > maxRight) maxRight = cursorX;
    if (ph > shelfH) shelfH = ph;
    if (cursorY + ph + SHEET_GAP_MM > sheetH) sheetH = cursorY + ph + SHEET_GAP_MM;
  }
  // 板寬取「設定板寬」與「實際最寬件」較大者 → 超寬零件（如整片桌面）不被裁掉
  const sheetW = Math.max(sheetWidthMm, maxRight);

  const parts: string[] = [];
  for (const pl of placed) {
    const d = outlinePathD(
      pl.item.outline.pts.map((p) => ({ x: p.x + pl.x, y: p.y + pl.y })),
    );
    const cx = pl.x + pl.item.outline.w / 2;
    const cy = pl.y + pl.item.outline.h / 2;
    parts.push(
      `  <g>`,
      `    <path d="${d}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"/>`,
      `    <text x="${round1(cx)}" y="${round1(cy)}" font-size="8" text-anchor="middle" fill="#888888">${escapeXml(pl.item.label)}</text>`,
      `  </g>`,
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round1(sheetW)}mm" height="${round1(sheetH)}mm" viewBox="0 0 ${round1(sheetW)} ${round1(sheetH)}">`,
    `  <title>${escapeXml(design.nameZh ?? "parts")} 套料排版 ${Math.round(sheetW)}×${Math.round(sheetH)}mm</title>`,
    `  <rect x="0" y="0" width="${round1(sheetW)}" height="${round1(sheetH)}" fill="none" stroke="#cccccc" stroke-width="0.5"/>`,
    ...parts,
    `</svg>`,
    "",
  ].join("\n");
}

// ---- 榫孔加工面 SVG（榫接版：連榫孔一起洗）----

/** 這個設計有沒有真的母榫（決定要不要顯示「榫孔面 SVG」按鈕）。 */
export function designHasMortises(design: FurnitureDesign): boolean {
  return design.parts.some((p) => (p.mortises?.length ?? 0) > 0);
}

/** 單一加工面 → 完整 SVG（外框 cut line + 每個榫孔內框）。 */
export function machiningFaceSvg(
  face: MachiningFace,
  opts?: { label?: string; faceLabel?: string },
): string {
  const vbW = face.w + MARGIN_MM * 2;
  const vbH = face.h + MARGIN_MM * 2;
  const shift = (p: { x: number; y: number }) => ({ x: p.x + MARGIN_MM, y: p.y + MARGIN_MM });
  const label = opts?.label ?? "";
  const faceLabel = opts?.faceLabel ?? face.faceLabelZh;
  const title = `${label}${label ? " " : ""}${faceLabel} — ${Math.round(face.w)}×${Math.round(face.h)}mm`;
  const holePaths: string[] = [];
  for (const h of face.holes) {
    if (h.kind === "circle" && h.cx != null && h.cy != null && h.r != null) {
      holePaths.push(
        `  <circle cx="${round1(h.cx + MARGIN_MM)}" cy="${round1(h.cy + MARGIN_MM)}" r="${round1(h.r)}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"><title>${escapeXml(h.label + (h.through ? "（通）" : "（盲）"))}</title></circle>`,
      );
    } else if (h.pts) {
      holePaths.push(
        `  <path d="${outlinePathD(h.pts.map(shift))}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"><title>${escapeXml(h.label + (h.through ? "（通）" : "（盲）"))}</title></path>`,
      );
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round1(vbW)}mm" height="${round1(vbH)}mm" viewBox="0 0 ${round1(vbW)} ${round1(vbH)}">`,
    `  <title>${escapeXml(title)}</title>`,
    `  <path d="${outlinePathD(face.outline.map(shift))}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"/>`,
    ...holePaths,
    `</svg>`,
    "",
  ].join("\n");
}

/**
 * 榫接版每零件的加工面 SVG。有母榫的零件 → 每個入榫面各一張（外框 + 榫孔）；
 * 沒母榫的零件 → 一張純外框（攤平面），讓 ZIP 是完整可切的一整組。
 * 回傳 { 檔名: svg 字串 }。
 */
export function joineryFacesSvgFiles(design: FurnitureDesign): Record<string, string> {
  const groups = groupPartsForDrawing(design);
  const files: Record<string, string> = {};
  const used = new Set<string>();
  const put = (base: string, svg: string) => {
    let name = `${base}.svg`;
    let n = 2;
    while (used.has(name)) name = `${base}-${n++}.svg`;
    used.add(name);
    files[name] = svg;
  };
  groups.forEach((g, i) => {
    const rep = g.representative;
    const code = `P-${String(i + 1).padStart(2, "0")}`;
    const name0 = groupDisplayName(g, "zh");
    const qtyTag = g.count > 1 ? ` ×${g.count}` : "";
    const faces = partMachiningFaces(rep);
    if (faces.length === 0) {
      // 無榫孔零件：純外框（攤平面）
      put(
        safeFileName(`${code}_${name0}`),
        partOutlineSvg(rep, { label: `${code} ${name0}`, qty: g.count }),
      );
      return;
    }
    for (const face of faces) {
      put(
        safeFileName(`${code}_${name0}_${face.faceLabelZh}`),
        machiningFaceSvg(face, { label: `${code} ${name0}${qtyTag}`, faceLabel: face.faceLabelZh }),
      );
    }
  });
  return files;
}

// ---- 瀏覽器下載 ----

function safeStem(design: FurnitureDesign): string {
  return safeFileName(design.nameZh ?? design.category ?? "parts");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 下載「每零件一張輪廓 SVG」的 ZIP。 */
export function downloadPartsSvgZip(design: FurnitureDesign) {
  const files = partsSvgFiles(design);
  const enc = new TextEncoder();
  const zipFiles: Record<string, Uint8Array> = {};
  for (const [name, svg] of Object.entries(files)) zipFiles[name] = enc.encode(svg);
  const zip = zipStore(zipFiles);
  const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  triggerDownload(new Blob([ab], { type: "application/zip" }), `${safeStem(design)}_零件輪廓.zip`);
}

/** 下載「所有零件套料排版」的合併 SVG。 */
export function downloadNestedSvg(design: FurnitureDesign, sheetWidthMm = DEFAULT_SHEET_WIDTH_MM) {
  const svg = nestedSheetSvg(design, sheetWidthMm);
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${safeStem(design)}_套料排版.svg`);
}

/** 下載「榫接版加工面 SVG（含榫孔）」的 ZIP —— 每零件每個入榫面一張。 */
export function downloadJoineryFacesZip(design: FurnitureDesign) {
  const files = joineryFacesSvgFiles(design);
  const enc = new TextEncoder();
  const zipFiles: Record<string, Uint8Array> = {};
  for (const [name, svg] of Object.entries(files)) zipFiles[name] = enc.encode(svg);
  const zip = zipStore(zipFiles);
  const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  triggerDownload(new Blob([ab], { type: "application/zip" }), `${safeStem(design)}_榫孔加工面.zip`);
}

// ---- helpers ----
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function safeFileName(s: string): string {
  return s.replace(/[^\w一-鿿.-]+/g, "_").replace(/^_+|_+$/g, "") || "part";
}
