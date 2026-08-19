// 一個加工面 → 一張 1:1 樣板 SVG（字串）。viewBox 單位 = mm = 紙面座標。
// 內容只有：輪廓、榫孔／公榫、部件名稱＋面別、100mm 證明尺。沒有尺寸標註、沒有三視圖。
import type { MachiningFace, FaceHole } from "@/lib/export/mortise-faces";
import { outlinePathD } from "@/lib/export/parts-svg";
import type { Placement } from "./fit";

/** 輪廓線寬 mm。比 CNC 的 0.1mm hairline 粗，列印才看得見。 */
const STROKE_MM = 0.3;
/** 證明尺長度 mm。 */
export const PROOF_RULER_MM = 100;
/** 部件名稱字級 mm。 */
const LABEL_FONT_MM = 6;
/** 名稱多行時的行距 mm。 */
const LABEL_LINE_MM = 7;
/** 輪廓內面別記號的字級上下限 mm。低於下限就放棄畫（窄到看不清了）。 */
const MARK_FONT_MAX_MM = 6;
const MARK_FONT_MIN_MM = 3;
/** 頁面四角保留框距紙邊 mm。 */
const CORNER_MARGIN_MM = 8;
/**
 * 證明尺／引線用的灰。
 * 這些是「紙面附註」，不是要描的線；跟輪廓同為黑色 0.3mm 實線時使用者分不出來，
 * 曾實測有樣板把腳的下端（正好是要點榫孔那端）疊在尺上。灰 + 虛線 = 一眼知道不要描。
 */
const NOTE_COLOR = "#666";

export interface TemplateSheetInput {
  face: MachiningFace;
  placement: Placement;
  partNo: string;
  nameZh: string;
  qty: number;
  /** 這是該零件的第幾個加工面（0-based）。單面時省略。 */
  faceIndex?: number;
  /** 該零件總共幾個加工面。單面時省略或給 1。 */
  faceCount?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 估算一行文字在 SVG 裡的實際寬度（mm）。
 *
 * 為什麼要估：舊版拿 `face.h >= 12` 當「放得下」的判準，但文字是沿 local x 軸畫、
 * text-anchor=middle，可用寬度是 face.w 不是 face.h。凳腳 w=35 / h=445 被判成
 * 放得下，實際 "P-01 凳腳 1 ×4"（約 44mm）橫跨兩條長邊壓在輪廓線上。
 *
 * 係數：全形（CJK / 全形標點）約 1.0 em，其餘拉丁字母數字約 0.54 em。
 * font-size 6 → 中文 6mm/字、拉丁 3.2mm/字。
 */
const FULLWIDTH_RE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

/** 一行文字有幾個 em 寬（乘上 font-size 就是 mm）。 */
function textEm(s: string): number {
  let em = 0;
  for (const ch of s) em += FULLWIDTH_RE.test(ch) ? 1 : 0.54;
  return em;
}

export function estTextWidthMm(s: string, fontSizeMm: number): number {
  return textEm(s) * fontSizeMm;
}

function holeMarkup(h: FaceHole): string {
  const t = `<title>${esc(h.label + (h.through ? "（通）" : "（盲）"))}</title>`;
  if (h.kind === "circle" && h.cx != null && h.cy != null && h.r != null) {
    const cross = Math.max(h.r * 0.8, 1.5);
    return [
      `<circle cx="${r2(h.cx)}" cy="${r2(h.cy)}" r="${r2(h.r)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}">${t}</circle>`,
      `<g data-mark="center-cross" stroke="#000" stroke-width="${STROKE_MM / 2}">`,
      `<line x1="${r2(h.cx - cross)}" y1="${r2(h.cy)}" x2="${r2(h.cx + cross)}" y2="${r2(h.cy)}"/>`,
      `<line x1="${r2(h.cx)}" y1="${r2(h.cy - cross)}" x2="${r2(h.cx)}" y2="${r2(h.cy + cross)}"/>`,
      `</g>`,
    ].join("");
  }
  if (!h.pts) return "";
  const cx = h.pts.reduce((s, p) => s + p.x, 0) / h.pts.length;
  const cy = h.pts.reduce((s, p) => s + p.y, 0) / h.pts.length;
  return [
    `<path d="${outlinePathD(h.pts)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}">${t}</path>`,
    `<g data-mark="center-cross" stroke="#000" stroke-width="${STROKE_MM / 2}">`,
    `<line x1="${r2(cx - 2)}" y1="${r2(cy)}" x2="${r2(cx + 2)}" y2="${r2(cy)}"/>`,
    `<line x1="${r2(cx)}" y1="${r2(cy - 2)}" x2="${r2(cx)}" y2="${r2(cy + 2)}"/>`,
    `</g>`,
  ].join("");
}

// ---------------------------------------------------------------------------
// 版面幾何（純函式，sheet.test.ts 用它守住旋轉平移那條式子）
// ---------------------------------------------------------------------------

export interface SheetLayout {
  pageW: number;
  pageH: number;
  angleDeg: number;
  /** 內容 group 的 translate 量（transform = translate(tx ty) rotate(angleDeg)）。 */
  tx: number;
  ty: number;
}

/**
 * 內容 group 的紙面變換。
 *
 * SVG rotate(θ) 以原點為軸、y 軸向下，(x,y) → (x·cosθ − y·sinθ, x·sinθ + y·cosθ)。
 * face 佔 [0,w]×[0,h]，四角轉完後：
 *   min x = −h·sinθ   max x = w·cosθ           → bw = w·cosθ + h·sinθ
 *   min y = 0          max y = w·sinθ + h·cosθ → bh = w·sinθ + h·cosθ
 * 也就是旋轉後 bbox 的左上角落在 (−h·sinθ, 0)，所以要把它平移回 (offX, offY)
 * 就得多補 +h·sinθ。transform 順序 translate ∘ rotate＝先轉再移。
 *
 * ⚠️ 這條 `+ face.h * Math.sin(t)` 是整份檔案最容易寫反的地方——改成 − 內容會整個
 * 飛出紙外，而尺、文字、字型檢查全都還在，舊測試與 verify:template 都抓不到。
 * sheet.test.ts 的「旋轉後四角必須落在紙內」就是專門守這條的，別把它拿掉。
 */
export function sheetLayout(face: MachiningFace, placement: Placement): SheetLayout {
  const { paper, angleDeg, swapped } = placement;
  const pageW = swapped ? paper.h : paper.w;
  const pageH = swapped ? paper.w : paper.h;
  const t = (angleDeg * Math.PI) / 180;
  const bw = face.w * Math.cos(t) + face.h * Math.sin(t);
  const bh = face.w * Math.sin(t) + face.h * Math.cos(t);
  const offX = (pageW - bw) / 2;
  const offY = (pageH - bh) / 2;
  return {
    pageW,
    pageH,
    angleDeg,
    tx: offX + face.h * Math.sin(t),
    ty: offY,
  };
}

/** 輪廓外框（local [0,w]×[0,h]）四角轉到紙面座標後的位置，順序：左上、右上、右下、左下。 */
export function contentCornersOnPage(
  face: MachiningFace,
  placement: Placement,
): Array<{ x: number; y: number }> {
  const { tx, ty, angleDeg } = sheetLayout(face, placement);
  const t = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return [
    { x: 0, y: 0 },
    { x: face.w, y: 0 },
    { x: face.w, y: face.h },
    { x: 0, y: face.h },
  ].map((p) => ({ x: tx + p.x * cos - p.y * sin, y: ty + p.x * sin + p.y * cos }));
}

// ---------------------------------------------------------------------------
// 紙面空白角的分配（證明尺、放不進輪廓的名稱牌）
// ---------------------------------------------------------------------------

interface Box { x0: number; y0: number; x1: number; y1: number }
type Pt = { x: number; y: number };
type Poly = Pt[];

function boxPoly(b: Box): Poly {
  return [
    { x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 },
    { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 },
  ];
}

/**
 * 兩個凸多邊形是否相交（SAT 分離軸）。
 *
 * 為什麼不用軸對齊 bbox：斜擺的細長零件（凳腳 35×445 @28°）bbox 幾乎鋪滿整張紙，
 * 用 bbox 判定會說「四個角全都被佔住」，尺就退回原位繼續壓在腳上——但實際上那四個
 * 角是空的，斜擺留下的正是角落空間。必須拿真正的旋轉四邊形去判。
 */
function polyOverlaps(a: Poly, b: Poly): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const nx = -(p2.y - p1.y);
      const ny = p2.x - p1.x;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const p of a) {
        const d = p.x * nx + p.y * ny;
        if (d < aMin) aMin = d;
        if (d > aMax) aMax = d;
      }
      for (const p of b) {
        const d = p.x * nx + p.y * ny;
        if (d < bMin) bMin = d;
        if (d > bMax) bMax = d;
      }
      if (aMax <= bMin || bMax <= aMin) return false;
    }
  }
  return true;
}

function bboxOf(pts: Poly): Box {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** box 內距離 p 最近的點（p 在 box 外時就落在邊上）。 */
function nearestInBox(box: Box, p: Pt) {
  return {
    x: Math.min(Math.max(p.x, box.x0), box.x1),
    y: Math.min(Math.max(p.y, box.y0), box.y1),
  };
}

function centerOf(b: Box) {
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
}

type CornerKey = "BL" | "BR" | "TL" | "TR";

function cornerBox(
  key: CornerKey, pageW: number, pageH: number, w: number, h: number,
  m: number = CORNER_MARGIN_MM,
): Box {
  const left = key === "BL" || key === "TL";
  const top = key === "TL" || key === "TR";
  const x0 = left ? m : Math.max(m, pageW - m - w);
  const y0 = top ? m : Math.max(m, pageH - m - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/**
 * 從偏好順序挑第一個不撞任何 blocker 的角。
 * 四個角都撞就回 order[0]——此時整張紙本來就沒有空白角，寧可疊也不要畫到紙外。
 */
function pickCorner(
  order: readonly CornerKey[],
  pageW: number,
  pageH: number,
  w: number,
  h: number,
  blockers: Poly[],
): Box {
  for (const key of order) {
    const box = cornerBox(key, pageW, pageH, w, h);
    const poly = boxPoly(box);
    if (!blockers.some((b) => polyOverlaps(poly, b))) return box;
  }
  return cornerBox(order[0], pageW, pageH, w, h);
}

/** 證明尺保留框的「厚度」mm（線 + 端點刻度 + 上方那行字）。 */
const RULER_BOX_H = 11;
/** 角落保留框的退讓階梯：先照正常留白找，找不到就貼近紙邊再找一輪。 */
const RULER_MARGINS = [CORNER_MARGIN_MM, 4] as const;

interface RulerPlacement { box: Box; vertical: boolean }

/**
 * 找證明尺畫在哪。
 *
 * 舊版寫死在 (10, pageH-10)，跟置中的內容互不迴避，實測 141 張有 14 張重疊
 * （含方凳腳——腳的下端正好壓在尺上，而那端就是要點榫孔的位置）。
 *
 * 候選順序：橫式四角（正常留白）→ 直式四角 → 橫式貼邊 → 直式貼邊。
 * 直式是必要的：桌面板這種「幾乎鋪滿整張紙」的零件，上下只剩 10mm 高的白邊塞不下
 * 橫尺，但左右各有 70mm 寬的白邊，轉 90° 就放得下。
 * 全部都撞（紙面真的沒空位）就回第一個候選——此時靠灰色虛線讓使用者分辨。
 */
function pickRuler(pageW: number, pageH: number, blockers: Poly[]): RulerPlacement {
  const order: CornerKey[] = ["BL", "BR", "TR", "TL"];
  const candidates: RulerPlacement[] = [];
  for (const m of RULER_MARGINS) {
    for (const vertical of [false, true]) {
      const w = vertical ? RULER_BOX_H : PROOF_RULER_MM;
      const h = vertical ? PROOF_RULER_MM : RULER_BOX_H;
      for (const key of order) {
        candidates.push({ box: cornerBox(key, pageW, pageH, w, h, m), vertical });
      }
    }
  }
  for (const c of candidates) {
    const poly = boxPoly(c.box);
    if (!blockers.some((b) => polyOverlaps(poly, b))) return c;
  }
  return candidates[0];
}

/**
 * 100mm 證明尺。座標全部是紙面絕對值（不包 transform），量測腳本與測試才好核對。
 *
 * 刻意用灰色虛線——舊版是黑色 0.3mm 實線、跟要描的輪廓一模一樣，重疊時描線分不出
 * 哪條是零件。端點刻度保持實線，量測時對得準。
 */
function rulerMarkup({ box, vertical }: RulerPlacement): string {
  // 主線離「框內側」2.5mm，端點刻度往兩側各 2.5mm，文字再外推 4mm。
  const a = vertical
    ? { x: box.x1 - 2.5, y: box.y1 }
    : { x: box.x0, y: box.y1 - 2.5 };
  const b = vertical
    ? { x: box.x1 - 2.5, y: box.y1 - PROOF_RULER_MM }
    : { x: box.x0 + PROOF_RULER_MM, y: box.y1 - 2.5 };
  // 端點刻度垂直於主線
  const tick = (p: { x: number; y: number }) =>
    vertical
      ? `<line x1="${r2(p.x - 2.5)}" y1="${r2(p.y)}" x2="${r2(p.x + 2.5)}" y2="${r2(p.y)}"/>`
      : `<line x1="${r2(p.x)}" y1="${r2(p.y - 2.5)}" x2="${r2(p.x)}" y2="${r2(p.y + 2.5)}"/>`;

  const tx = vertical ? box.x1 - 6.5 : box.x0 + PROOF_RULER_MM / 2;
  const ty = vertical ? box.y1 - PROOF_RULER_MM / 2 : box.y1 - 6.5;
  const rotate = vertical ? ` transform="rotate(-90 ${r2(tx)} ${r2(ty)})"` : "";

  return [
    `<g data-mark="proof-ruler" data-ruler-box="${r2(box.x0)} ${r2(box.y0)} ${r2(box.x1)} ${r2(box.y1)}"`,
    ` stroke="${NOTE_COLOR}" stroke-width="${STROKE_MM}" fill="none">`,
    `<line x1="${r2(a.x)}" y1="${r2(a.y)}" x2="${r2(b.x)}" y2="${r2(b.y)}" stroke-dasharray="3 1.5"/>`,
    tick(a),
    tick(b),
    `</g>`,
    `<text x="${r2(tx)}" y="${r2(ty)}"${rotate} font-family="PackCJK" font-size="4"`,
    ` font-weight="400" fill="${NOTE_COLOR}" text-anchor="middle">此線實長 100mm — 列印請選「實際大小」</text>`,
  ].join("");
}

// ---------------------------------------------------------------------------

export function templateSheetSvg(input: TemplateSheetInput): string {
  const { face, placement, partNo, nameZh, qty } = input;
  const faceCount = input.faceCount ?? 1;
  const faceIndex = input.faceIndex ?? 0;
  const { pageW, pageH, tx, ty, angleDeg } = sheetLayout(face, placement);
  const transform = `translate(${r2(tx)} ${r2(ty)}) rotate(${r2(angleDeg)})`;

  const geometry = [
    `<path d="${outlinePathD(face.outline)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}"/>`,
    ...(face.tenons ?? []).map(
      (tn) =>
        `<path d="${outlinePathD(tn.pts)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}"><title>${esc(tn.label + "（公榫）")}</title></path>`,
    ),
    ...face.holes.map(holeMarkup),
  ].join("\n    ");

  // 名稱牌內容。面別一定要出現——方料腳四個面外觀完全一樣，不標就會貼錯 90°；
  // 多加工面時再加一行「第 N 面 / 共 M 面」，使用者才知道還有另一張要翻面做。
  const faceMark = `【${face.faceLabelZh}】`;
  const lines = [`${partNo} ${nameZh}${qty > 1 ? ` ×${qty}` : ""}　${faceMark}`];
  if (faceCount > 1) lines.push(`第 ${faceIndex + 1} 面 / 共 ${faceCount} 面`);

  const labelW = Math.max(...lines.map((l) => estTextWidthMm(l, LABEL_FONT_MM)));
  const labelH = (lines.length - 1) * LABEL_LINE_MM + LABEL_FONT_MM;
  // 可用寬度是 face.w（文字沿 local x 軸畫、text-anchor=middle），不是 face.h。
  const insideOutline = labelW <= face.w - 2 && labelH + 2 <= face.h;

  const textTag = (
    x: number, y: number, size: number, anchor: string, s: string,
  ) =>
    `<text x="${r2(x)}" y="${r2(y)}" font-family="PackCJK" font-size="${r2(size)}"` +
    ` font-weight="700" fill="#000" text-anchor="${anchor}">${esc(s)}</text>`;

  const local: string[] = [];
  const pageLevel: string[] = [];
  // 內容佔位＝旋轉後的輪廓四邊形本身（不是它的軸對齊 bbox，見 polyOverlaps 註解）。
  const contentPoly = contentCornersOnPage(face, placement);
  const blockers: Poly[] = [contentPoly];

  if (insideOutline) {
    const first = face.h / 2 - labelH / 2 + LABEL_FONT_MM;
    lines.forEach((l, i) =>
      local.push(textTag(face.w / 2, first + i * LABEL_LINE_MM, LABEL_FONT_MM, "middle", l)),
    );
  } else {
    // 名稱牌放紙面空白角 + 引線指回輪廓。角落是紙面座標（不隨零件轉），字永遠是正的。
    //
    // 但面別記號還是要盡量留在輪廓「裡面」：使用者會沿輪廓裁下樣板貼到木料上，
    // 裁完紙角的名稱牌就沒了，只剩一片沒有面別的紙——這正是貼錯 90° 的成因。
    // 字級照 face.w 自適應縮到最小 3mm，真的窄到放不下才放棄。
    const markSize = Math.min(MARK_FONT_MAX_MM, (face.w - 2) / textEm(faceMark));
    if (markSize >= MARK_FONT_MIN_MM && face.h >= markSize + 2) {
      local.push(textTag(face.w / 2, face.h / 2 + markSize / 2 - 0.5, markSize, "middle", faceMark));
    }

    const plate = pickCorner(
      ["TL", "TR", "BL", "BR"],
      pageW,
      pageH,
      labelW,
      labelH + 2,
      blockers,
    );
    blockers.push(boxPoly(plate));
    lines.forEach((l, i) =>
      pageLevel.push(
        textTag(plate.x0, plate.y0 + LABEL_FONT_MM + i * LABEL_LINE_MM, LABEL_FONT_MM, "start", l),
      ),
    );
    // 引線指到「輪廓四邊形離名稱牌最近的角」，不是 bbox 的角——斜擺時 bbox 的角
    // 落在空白處，線會停在半空中。
    const plateC = centerOf(plate);
    const to = contentPoly.reduce((best, p) =>
      (p.x - plateC.x) ** 2 + (p.y - plateC.y) ** 2 < (best.x - plateC.x) ** 2 + (best.y - plateC.y) ** 2
        ? p
        : best,
    );
    const from = nearestInBox(plate, to);
    pageLevel.push(
      `<line data-mark="label-leader" x1="${r2(from.x)}" y1="${r2(from.y)}" x2="${r2(to.x)}" y2="${r2(to.y)}"` +
        ` stroke="${NOTE_COLOR}" stroke-width="${STROKE_MM / 2}" stroke-dasharray="2 2"/>`,
    );
  }

  const ruler = pickRuler(pageW, pageH, blockers);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`,
    `  <g transform="${transform}">`,
    `    ${geometry}`,
    ...local.map((l) => `    ${l}`),
    `  </g>`,
    ...pageLevel.map((l) => `  ${l}`),
    `  ${rulerMarkup(ruler)}`,
    `</svg>`,
    "",
  ].join("\n");
}
