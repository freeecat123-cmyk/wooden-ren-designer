/**
 * 零件輪廓 SVG 匯出 —— 把每個零件的「攤平切割面」輸出成乾淨的 mm 尺寸向量輪廓，
 * 供 CNC / 雷切 / 向量編輯用（直接餵進 designer.woodenren.com/cnc.html → G-code）。
 *
 * 兩種產出：
 *   1. partsSvgFiles(design)      → 每個零件（合併同形）一張輪廓 SVG，打包成 ZIP。
 *   2. nestedSheetSvgFiles(design) → 所有零件輪廓套料排進板材，依「材質×料厚」分張，
 *      每張一個 SVG（刀線式排料 + 刀縫，見 lib/export/nest-sheet.ts）。
 *
 * 輪廓來源＝projectPartSilhouette（含所有造型：錐腳 / 弧肩斜腳 / 倒角 / 圓料 / 斜切…）。
 * 每個零件取「三主視圖（front/side/top）中投影面積最大者」＝攤平躺平的那一面。
 */
import type { FurnitureDesign, Part } from "@/lib/types";
import { projectPartSilhouette, type OrthoView } from "@/lib/render/geometry";
import { groupPartsForDrawing, groupDisplayName } from "@/lib/render/part-drawing/grouping";
import { zipStore } from "@/lib/export/zip-store";
import { partMachiningFaces, type MachiningFace, type DerivedMortise } from "@/lib/export/mortise-faces";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { effectiveBillableMaterial } from "@/lib/pricing/catalog";
import { materialZh } from "@/lib/cutplan/group";
import {
  nestPieces,
  DEFAULT_SHEET,
  type NestPiece,
  type NestSheetConfig,
  type NestedSheet,
} from "@/lib/export/nest-sheet";

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

// ---- 套料排版（刀線式 guillotine）：所有零件排進實際板材，每張板一個 SVG ----

/**
 * 零件的「料別」——決定它能跟誰排在同一張板上。
 *
 * ⭐一定要分開：18mm 夾板的側板和 45mm 的桌腳排在同一張圖上，那張圖根本切不出來
 * （原本的版本不分料別，全部倒進同一張板）。實木還要再分木種，因為那是不同的板。
 * 料厚取切料尺寸的最短邊（＝這片攤平躺在板上時的厚度），與裁切計算器同一套判定。
 */
function partStock(part: Part): Pick<NestPiece, "stockKey" | "stockLabel" | "allowRotate"> {
  const cut = calculateCutDimensions(part);
  const thickness = Math.min(cut.length, cut.width, cut.thickness);
  const billable = effectiveBillableMaterial(part);
  const isSheet = billable === "plywood" || billable === "mdf";
  const thkTag = `${Math.round(thickness * 10) / 10}mm`;
  const name = isSheet ? (billable === "mdf" ? "密迪板" : "夾板") : materialZh(billable);
  return {
    stockKey: `${billable}|${thkTag}`,
    stockLabel: `${thkTag} ${name}`,
    // 板材可以隨便轉 90° 擠得更緊；實木不行——轉了木紋就橫過來，強度與伸縮全變。
    // 實木改用 orientGrain() 先擺成「長邊沿板長」，之後就不再翻動。
    allowRotate: isSheet,
  };
}

/**
 * 實木零件先轉成「長邊橫放」再排。
 *
 * ⭐這不是為了美觀，是兩件事同時要解：
 *  ① **木紋**：家具零件的纖維幾乎一定沿最長邊走（腳的木紋沿高度、橫檔沿長度）。
 *    長邊橫放＝木紋沿板長，正是實木板該有的取料方向。
 *  ② **不能亂放大板子**：攤平輪廓的方向是「面積最大的那個投影」決定的，本身是任意的。
 *    一支 60×1664 的立柱剛好投影成直的，若死守方向不轉，板寬就得撐到 1.68m ——
 *    世界上沒有這種板。轉成 1664×60 之後一張 4×8 就放得下。
 * 板材不走這條（它可以自由旋轉，交給排料器決定）。
 */
function orientGrain(p: NestPiece): NestPiece {
  if (p.allowRotate || p.h <= p.w) return p;
  const H = p.h;
  // 順時針 90°：(x,y) → (H−y, x)；外框、圓孔、內框要一起轉，不然孔會跑掉
  const rot = (q: { x: number; y: number }) => ({ x: H - q.y, y: q.x });
  return {
    ...p,
    outline: p.outline.map(rot),
    circles: p.circles?.map((c) => ({ ...c, cx: H - c.cy, cy: c.cx })),
    innerPaths: p.innerPaths?.map((ip) => ({ ...ip, pts: ip.pts.map(rot) })),
    w: p.h,
    h: p.w,
  };
}

/**
 * 排料要不要收這個零件。
 * 非木材（五金、玻璃、把手…帶 visual 提示的零件）不進切割圖——它們是買來的，
 * 混進去只會多開一張「30mm 板」然後上面躺一顆銅把手。判定與裁切計算器同一條規則。
 */
function isCuttable(part: Part): boolean {
  return part.visual === undefined;
}

/** 一張板 → SVG 字串。viewBox 就是板子的實際 mm 尺寸，直接餵 CNC / 雷切。 */
function sheetSvg(sheet: NestedSheet, designName: string, kerfMm: number): string {
  const body: string[] = [];
  for (const pl of sheet.pieces) {
    // 旋轉用 group transform 而不是把座標算進點裡：圓孔（<circle>）也才會跟著轉。
    // SVG 的 rotate(90) 在 y 向下的座標系是順時針：(px,py) → (−py,px)，
    // 所以再往 +x 補一個 h 才會落回擺放框的左上角。
    const tf = pl.rotated
      ? `translate(${round1(pl.x + pl.piece.h)} ${round1(pl.y)}) rotate(90)`
      : `translate(${round1(pl.x)} ${round1(pl.y)})`;
    const inner: string[] = [];
    for (const c of pl.piece.circles ?? []) {
      inner.push(
        `    <circle cx="${round1(c.cx)}" cy="${round1(c.cy)}" r="${round1(c.r)}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"/>`,
      );
    }
    for (const p of pl.piece.innerPaths ?? []) {
      inner.push(
        `    <path d="${outlinePathD(p.pts)}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"/>`,
      );
    }
    body.push(
      `  <g transform="${tf}">`,
      `    <path d="${outlinePathD(pl.piece.outline)}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"/>`,
      ...inner,
      `  </g>`,
    );
    // 編號畫在擺放框中央、**不進旋轉群組**，轉過的零件標籤才不會跟著側躺看不懂
    body.push(
      `  <text x="${round1(pl.x + pl.w / 2)}" y="${round1(pl.y + pl.h / 2)}" font-size="8" text-anchor="middle" fill="#888888">${escapeXml(pl.piece.label)}${pl.rotated ? " ↻" : ""}</text>`,
    );
  }
  const pct = Math.round(sheet.utilization * 100);
  const title =
    `${designName} 套料 — ${sheet.stockLabel} 板 ${sheet.index}/${sheet.total}` +
    ` · 需備料 ${Math.round(sheet.lengthMm)}×${Math.round(sheet.widthMm)}mm` +
    `（排進 ${Math.round(sheet.stockLengthMm)}×${Math.round(sheet.stockWidthMm)} 板材）` +
    ` · 零件占 ${pct}% · 刀縫 ${kerfMm}mm` +
    (sheet.enlarged ? " ⚠有零件超過標準板尺寸，板已放大" : "");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round1(sheet.lengthMm)}mm" height="${round1(sheet.widthMm)}mm" viewBox="0 0 ${round1(sheet.lengthMm)} ${round1(sheet.widthMm)}">`,
    `  <title>${escapeXml(title)}</title>`,
    `  <rect x="0" y="0" width="${round1(sheet.lengthMm)}" height="${round1(sheet.widthMm)}" fill="none" stroke="#cccccc" stroke-width="0.5"/>`,
    ...body,
    `</svg>`,
    "",
  ].join("\n");
}

/** 排好的板 → { 檔名: svg }。檔名帶料別/第幾張/利用率，在 Finder 就看得出來。 */
function sheetsToFiles(sheets: NestedSheet[], designName: string, kerfMm: number): Record<string, string> {
  const files: Record<string, string> = {};
  const used = new Set<string>();
  for (const s of sheets) {
    // 檔名帶「料別 + 第幾張 + 要備多大的料」——在 Finder 直接看得出要去買什麼、切多少
    const base = safeFileName(
      `${s.stockLabel}_板${s.index}of${s.total}_${Math.round(s.lengthMm)}x${Math.round(s.widthMm)}mm`,
    );
    let name = `${base}.svg`;
    let n = 2;
    while (used.has(name)) name = `${base}-${n++}.svg`;
    used.add(name);
    files[name] = sheetSvg(s, designName, kerfMm);
  }
  return files;
}

/**
 * 所有零件（依實際數量展開）排進板材。**依料別分張、刀線式排料、留刀縫**。
 * 回傳 { 檔名: svg }：料別 × 板數各一張。
 */
export function nestedSheetSvgFiles(
  design: FurnitureDesign,
  cfg: NestSheetConfig = DEFAULT_SHEET,
): Record<string, string> {
  const groups = groupPartsForDrawing(design);
  const items: NestPiece[] = [];
  groups.forEach((g, i) => {
    const rep = g.representative;
    if (!isCuttable(rep)) return;
    const o = partFlatOutline(rep);
    const stock = partStock(rep);
    const label = `P-${String(i + 1).padStart(2, "0")}`;
    const piece = orientGrain({ label, outline: o.pts, w: o.w, h: o.h, ...stock });
    for (let k = 0; k < g.count; k++) items.push(piece);
  });
  return sheetsToFiles(nestPieces(items, cfg), design.nameZh ?? "parts", cfg.kerfMm);
}

// ---- 榫孔加工面 SVG（榫接版：連榫孔一起洗）----

/** 這個設計有沒有榫接（母榫或公榫）——決定要不要顯示榫孔加工面 / 套料按鈕。 */
export function designHasMortises(design: FurnitureDesign): boolean {
  return design.parts.some((p) => (p.mortises?.length ?? 0) > 0 || (p.tenons?.length ?? 0) > 0);
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
  const tenonPaths = (face.tenons ?? []).map(
    (t) => `  <path d="${outlinePathD(t.pts.map(shift))}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"><title>${escapeXml(t.label + "（公榫，切外形時一起切出）")}</title></path>`,
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round1(vbW)}mm" height="${round1(vbH)}mm" viewBox="0 0 ${round1(vbW)} ${round1(vbH)}">`,
    `  <title>${escapeXml(title)}</title>`,
    `  <path d="${outlinePathD(face.outline.map(shift))}" fill="none" stroke="#000000" stroke-width="${CUT_STROKE_MM}"/>`,
    ...tenonPaths,
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
  const derivedMap = deriveMortisesByPart(design.parts);
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
    const faces = partMachiningFaces(rep, derivedFor(rep, derivedMap));
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

/** 一個零件在「榫孔套料」上要排的一個加工面(外框+該面的榫孔/公榫)。 */
interface JoineryFacePiece {
  outline: Array<{ x: number; y: number }>;
  holes: MachiningFace["holes"];
  tenons: MachiningFace["tenons"];
  w: number;
  h: number;
  label: string;
}

/**
 * 只對「沒有真母榫」的零件套用反推母榫（有真母榫的直腳等不重複挖）。
 * ⚠️ 暫時停用：反推對弧肩斜腳等錐形/外撇腳幾何還不穩（孔會凸框、漏橫撐），
 * 幾何磨對前先回 []，避免出錯孔。module 與 map 保留，改回下一行即可重啟。
 */
function derivedFor(_part: Part, _map: Map<string, DerivedMortise[]>): DerivedMortise[] {
  return [];
  // return (_part.mortises?.length ?? 0) > 0 ? [] : (_map.get(_part.id) ?? []);
}

/** faceKey → 入榫軸（同軸的對面對＝通榫重複，套料只留一張）。 */
const FACE_AXIS: Record<string, string> = {
  top: "y", bottom: "y", front: "z", back: "z", left: "x", right: "x",
};

/**
 * 一個零件在「榫孔套料」上要排的所有面：每個有榫孔的加工面各一片
 * （桌腳兩個垂直面各一片）。同一軸的對面對（通榫掛在頂/底兩張）只留榫孔多的那張，
 * 避免同一塊板被排兩次。沒榫孔的零件回單片外框。
 */
function partNestPieces(part: Part, code: string, derived: DerivedMortise[] = []): JoineryFacePiece[] {
  const faces = partMachiningFaces(part, derived);
  if (faces.length === 0) {
    const o = partFlatOutline(part);
    return [{ outline: o.pts, holes: [], tenons: [], w: o.w, h: o.h, label: code }];
  }
  // 依軸收斂：同軸只留榫孔最多（同數取面積大）的一張
  const byAxis = new Map<string, MachiningFace>();
  for (const f of faces) {
    const axis = FACE_AXIS[f.faceKey] ?? f.faceKey;
    const cur = byAxis.get(axis);
    if (!cur || f.holes.length > cur.holes.length || (f.holes.length === cur.holes.length && f.w * f.h > cur.w * cur.h)) {
      byAxis.set(axis, f);
    }
  }
  return [...byAxis.values()].map((f) => ({
    outline: f.outline,
    holes: f.holes,
    tenons: f.tenons,
    w: f.w,
    h: f.h,
    label: byAxis.size > 1 ? `${code} ${f.faceLabelZh}` : code,
  }));
}

/**
 * 榫孔套料：所有零件「每個有榫孔的加工面」（含該面榫孔）刀線式排進板材，依料別分張。
 * 桌腳等兩個垂直面有孔的零件會排兩片（各標面別，翻面分兩次夾）。
 */
export function nestedJoinerySheetSvgFiles(
  design: FurnitureDesign,
  cfg: NestSheetConfig = DEFAULT_SHEET,
): Record<string, string> {
  const groups = groupPartsForDrawing(design);
  const derivedMap = deriveMortisesByPart(design.parts);
  const items: NestPiece[] = [];
  groups.forEach((g, i) => {
    const rep = g.representative;
    if (!isCuttable(rep)) return;
    const stock = partStock(rep);
    const faces = partNestPieces(rep, `P-${String(i + 1).padStart(2, "0")}`, derivedFor(rep, derivedMap));
    const pieces = faces.map((f) =>
      orientGrain({
        label: f.label,
        outline: f.outline,
        w: f.w,
        h: f.h,
        circles: f.holes
          .filter((h) => h.kind === "circle" && h.cx != null && h.cy != null && h.r != null)
          .map((h) => ({ cx: h.cx!, cy: h.cy!, r: h.r!, title: h.label })),
        innerPaths: [
          ...(f.tenons ?? []).map((t) => ({ pts: t.pts, title: t.label })),
          ...f.holes.filter((h) => h.kind !== "circle" && h.pts).map((h) => ({ pts: h.pts!, title: h.label })),
        ],
        ...stock,
      }),
    );
    for (let k = 0; k < g.count; k++) items.push(...pieces);
  });
  return sheetsToFiles(nestPieces(items, cfg), `${design.nameZh ?? "parts"} 榫孔`, cfg.kerfMm);
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

function downloadSvgFiles(files: Record<string, string>, stem: string) {
  const names = Object.keys(files);
  // 只有一張板就直接給 SVG，不要為了一個檔逼人解壓縮；多張才打包。
  if (names.length === 1) {
    triggerDownload(new Blob([files[names[0]]], { type: "image/svg+xml" }), `${stem}_${names[0]}`);
    return;
  }
  const enc = new TextEncoder();
  const zipFiles: Record<string, Uint8Array> = {};
  for (const [name, svg] of Object.entries(files)) zipFiles[name] = enc.encode(svg);
  const zip = zipStore(zipFiles);
  const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  triggerDownload(new Blob([ab], { type: "application/zip" }), `${stem}.zip`);
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

/**
 * 下載套料排版。依料別（材質×厚度）分張、刀線式排料、留刀縫；
 * 一張板 → 單一 SVG，多張 → ZIP（檔名帶料別 / 第幾張 / 利用率）。
 */
export function downloadNestedSvg(design: FurnitureDesign, cfg: NestSheetConfig = DEFAULT_SHEET) {
  downloadSvgFiles(nestedSheetSvgFiles(design, cfg), `${safeStem(design)}_套料排版`);
}

/** 下載榫孔套料（同上，但每片含該面的榫孔／公榫，外框和孔一次裝夾切完）。 */
export function downloadNestedJoinerySvg(design: FurnitureDesign, cfg: NestSheetConfig = DEFAULT_SHEET) {
  downloadSvgFiles(nestedJoinerySheetSvgFiles(design, cfg), `${safeStem(design)}_榫孔套料`);
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
