// 一張 A4 拼接紙的 SVG 字串產生器。搭配 tiling.ts 的規劃結果，一個大於 A4 的
// 加工面被切成多張 A4，這裡負責把每一張畫出來。
//
// 對位方式（2026-08-20 定稿，取代最早「四角重疊十字」的草案）：
// 「裁一邊、對一線」——裁縫紙型的標準做法，不是雙層重疊貼合。
//   - 每張的右邊／下邊（若有右鄰／下鄰）畫實線「裁切線」，使用者裁掉這條線
//     右／下側的重複內容。
//   - 每張的左邊／上邊（若有左鄰／上鄰）畫灰色虛線「對齊線」，使用者把上一張
//     裁好的邊對齊這條線再貼。
// 這兩條線之所以能對準，是因為 tilePageGeometry 算出來的座標滿足：
//   tileA 的裁切線（換算回 face 座標）＝ tileB 的對齊線（換算回 face 座標）
// 見 tile-sheet.test.ts「裁切線與下一張對齊線指向同一個 face 座標」——這是
// 整個拼接功能對不對得準的數學保證，不是畫好看而已，改動前務必先看那條測試。
import type { MachiningFace } from "@/lib/export/mortise-faces";
import { outlinePathD } from "@/lib/export/parts-svg";
import { PAPERS } from "./paper";
import { TILE_OVERLAP_MM, TILE_MARGIN_MM, type TilePlan, type TileSpec } from "./tiling";
import {
  r2,
  esc,
  holeMarkup,
  pickRuler,
  rulerMarkup,
  boxPoly,
  estTextWidthMm,
  NOTE_COLOR,
  type Box,
  type Poly,
  type Pt,
  type RulerPlacement,
} from "./sheet";

const A4 = PAPERS.find((p) => p.id === "A4")!;

/** 輪廓線寬 mm，跟 sheet.ts 一致。 */
const STROKE_MM = 0.3;
/** 裁切線／對齊線線寬。裁切線要粗到用剪刀／美工刀沿著切好認，比輪廓稍粗。 */
const SEAM_STROKE_MM = 0.5;
/** 對角自檢線的顏色——淡灰，不能跟輪廓或裁切線混淆，純粹是「貼完是否還直」的自我檢查。 */
const DIAGONAL_COLOR = "#bbb";

export interface TilePageGeometry {
  pageW: number;
  pageH: number;
  /** 內容 group 的 translate 量。 */
  tx: number;
  ty: number;
  /** clip 區（＝可用區，紙面座標）。 */
  usable: Box;
  /** 四角／裁切線／對齊線座標，紙面座標。 */
  leftX: number;
  topY: number;
  rightX: number;
  bottomY: number;
  hasLeft: boolean;
  hasRight: boolean;
  hasTop: boolean;
  hasBottom: boolean;
}

/**
 * 這張 tile 在紙面上的幾何。純函式，跟 sheet.ts 的 sheetLayout 同一個角色。
 *
 * leftX / topY 永遠等於留白：tiling.ts 的窗格公式（x ∈ [c·stepW, c·stepW+usableW]）
 * 每張的左／上邊本來就是「這張自己的起點」，不會有前導的重複內容——重複量全部
 * 堆在右／下側（窗格比 stepW 寬出 overlap）。這就是為什麼「只裁右／下」就夠、
 * 左／上邊不需要裁：那一側本來就沒有多餘的東西。
 */
export function tilePageGeometry(plan: TilePlan, tile: TileSpec): TilePageGeometry {
  const pageW = plan.landscape ? A4.w : A4.h;
  const pageH = plan.landscape ? A4.h : A4.w;
  const margin = TILE_MARGIN_MM;
  const hasLeft = tile.c > 0;
  const hasRight = tile.c < plan.cols - 1;
  const hasTop = tile.r > 0;
  const hasBottom = tile.r < plan.rows - 1;
  return {
    pageW,
    pageH,
    tx: margin - tile.x,
    ty: margin - tile.y,
    usable: { x0: margin, y0: margin, x1: pageW - margin, y1: pageH - margin },
    leftX: margin,
    topY: margin,
    rightX: hasRight ? pageW - margin - TILE_OVERLAP_MM : pageW - margin,
    bottomY: hasBottom ? pageH - margin - TILE_OVERLAP_MM : pageH - margin,
    hasLeft,
    hasRight,
    hasTop,
    hasBottom,
  };
}

/** 紙面座標換算回 face 座標（用 tile 自己的 tx/ty）——驗證跨張對位用。 */
export function pageToFace(tile: TileSpec, px: number, py: number): { x: number; y: number } {
  const margin = TILE_MARGIN_MM;
  return { x: px - margin + tile.x, y: py - margin + tile.y };
}

export interface TileSheetInput {
  face: MachiningFace;
  plan: TilePlan;
  tile: TileSpec;
  partNo: string;
  nameZh: string;
  qty: number;
  /** 這是該零件的第幾個加工面（0-based）。單面時省略。 */
  faceIndex?: number;
  /** 該零件總共幾個加工面。單面時省略或給 1。 */
  faceCount?: number;
}

/** 欄字母：0→A, 1→B…（MAX_TILES_PER_FACE=6，欄數不會超過 F，用不到雙字母）。 */
function colLetter(c: number): string {
  return String.fromCharCode(65 + c);
}

/**
 * 向上箭頭——手繪三角形，不依賴字型裡有沒有箭頭字符（安全、保證能印出來）。
 * 三角形＋「上」字疊成一欄窄窄的直式標記，跟旁邊的格子編號同一個起始高度，
 * 不佔太多垂直空間（資訊區塊本來就要跟內容做碰撞迴避，越省空間越好）。
 */
function upArrowMarkup(cx: number, topY: number): string {
  const w = 4;
  const h = 3.5;
  const pts = `${r2(cx)},${r2(topY)} ${r2(cx - w / 2)},${r2(topY + h)} ${r2(cx + w / 2)},${r2(topY + h)}`;
  return (
    `<g data-mark="up-arrow">` +
    `<polygon points="${pts}" fill="#000"/>` +
    `<text x="${r2(cx)}" y="${r2(topY + h + 3.2)}" font-family="PackCJK" font-size="3.2"` +
    ` font-weight="700" fill="#000" text-anchor="middle">上</text>` +
    `</g>`
  );
}

/** 四角對位十字——圓圈＋十字，跟孔位中心十字用不同符號，避免使用者誤認成要鑿的孔。 */
function registerCross(x: number, y: number): string {
  const arm = 3.5;
  const rr = 1.8;
  return (
    `<g data-mark="tile-register" stroke="#000" stroke-width="${SEAM_STROKE_MM}" fill="none">` +
    `<circle cx="${r2(x)}" cy="${r2(y)}" r="${rr}"/>` +
    `<line x1="${r2(x - arm)}" y1="${r2(y)}" x2="${r2(x + arm)}" y2="${r2(y)}"/>` +
    `<line x1="${r2(x)}" y1="${r2(y - arm)}" x2="${r2(x)}" y2="${r2(y + arm)}"/>` +
    `</g>`
  );
}

/** 裁切線（實線）：使用者沿這條線把重複內容裁掉。垂直＝右邊，水平＝下邊。 */
function cutLineMarkup(vertical: boolean, pos: number, from: number, to: number): string {
  const line = vertical
    ? `<line x1="${r2(pos)}" y1="${r2(from)}" x2="${r2(pos)}" y2="${r2(to)}"/>`
    : `<line x1="${r2(from)}" y1="${r2(pos)}" x2="${r2(to)}" y2="${r2(pos)}"/>`;
  const tx = vertical ? pos : (from + to) / 2;
  const ty = vertical ? (from + to) / 2 : pos;
  const rotate = vertical ? ` transform="rotate(-90 ${r2(tx)} ${r2(ty)})"` : "";
  return (
    `<g data-mark="cut-line" stroke="#000" stroke-width="${SEAM_STROKE_MM}">` +
    line +
    `</g>` +
    `<text x="${r2(tx + (vertical ? 0 : 0))}" y="${r2(ty - 1.5)}"${rotate} font-family="PackCJK"` +
    ` font-size="3.2" font-weight="700" fill="#000" text-anchor="middle">沿此線裁</text>`
  );
}

/** 對齊線（灰色虛線）：把上一張裁好的邊對齊這條線再貼。垂直＝左邊，水平＝上邊。 */
function alignLineMarkup(vertical: boolean, pos: number, from: number, to: number): string {
  const line = vertical
    ? `<line x1="${r2(pos)}" y1="${r2(from)}" x2="${r2(pos)}" y2="${r2(to)}" stroke-dasharray="3 1.5"/>`
    : `<line x1="${r2(from)}" y1="${r2(pos)}" x2="${r2(to)}" y2="${r2(pos)}" stroke-dasharray="3 1.5"/>`;
  const tx = vertical ? pos : (from + to) / 2;
  const ty = vertical ? (from + to) / 2 : pos;
  const rotate = vertical ? ` transform="rotate(-90 ${r2(tx)} ${r2(ty)})"` : "";
  return (
    `<g data-mark="align-line" stroke="${NOTE_COLOR}" stroke-width="${SEAM_STROKE_MM}">` +
    line +
    `</g>` +
    `<text x="${r2(tx)}" y="${r2(ty + 4.5)}"${rotate} font-family="PackCJK"` +
    ` font-size="3.2" font-weight="400" fill="${NOTE_COLOR}" text-anchor="middle">上一張的裁切邊對齊此線</text>`
  );
}

/** 兩個矩形是否重疊。A4 拼接一律不旋轉（brief 決策 2），所有 box 都是軸對齊，
 * 不需要 sheet.ts 那套給斜擺零件用的 SAT／OBB。 */
function aabbOverlap(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * 資訊區塊（箭頭＋格子編號＋件名）放哪個角。
 *
 * 舊版固定寫死左上角，方凳凳腳（35mm 寬）這種窄零件會讓「P-01a 凳腳 1 ×4」
 * 這行字整條壓在輪廓的右邊那條線上、看起來像被劃掉——2026-08-20 拿 playwright
 * 截圖驗證時實測踩到。跟 sheet.ts 的名稱牌／證明尺同一個道理：先用內容範圍
 * （contentBox）當 blocker，四角挑第一個不撞的；四角都撞就退回左上角
 * （此時本來就沒有真正空白的角，寧可疊也不要跑出紙外）。
 */
function pickInfoCorner(usable: Box, blockW: number, blockH: number, contentBox: Box): { x0: number; y0: number } {
  const pad = 3;
  const candidates = [
    { x0: usable.x0 + pad, y0: usable.y0 + pad }, // TL
    { x0: usable.x1 - pad - blockW, y0: usable.y0 + pad }, // TR
    { x0: usable.x0 + pad, y0: usable.y1 - pad - blockH }, // BL
    { x0: usable.x1 - pad - blockW, y0: usable.y1 - pad - blockH }, // BR
  ];
  for (const c of candidates) {
    const box: Box = { x0: c.x0, y0: c.y0, x1: c.x0 + blockW, y1: c.y0 + blockH };
    if (!aabbOverlap(box, contentBox)) return c;
  }
  return candidates[0];
}

/**
 * sheet.ts 的 pickRuler／cornerBox 是拿「整張紙」(0,0)-(pageW,pageH) 當退讓基準
 * （CORNER_MARGIN_MM=8mm），量的是離紙張實體邊緣的距離。A4 拼接把留白拉大到 15mm
 * 就是為了讓所有東西都離開印表機的不可列印區——如果直接把 pageW/pageH 丟給
 * pickRuler，退讓量只有 8mm < 15mm，尺可能被排到 15mm 留白帶裡面，正好是這次
 * 改版要避免的事。做法：把「可用區」(usable rect) 當成虛擬的紙丟給 pickRuler，
 * 算完再把結果平移回真正的頁面座標——這樣退讓永遠是「離可用區邊緣 8mm」，
 * 換算成離紙張實體邊緣至少 15+4=19mm（貼邊 fallback 那一輪也一樣安全）。
 */
function pickRulerInFrame(usable: Box, blockers: Poly[]): RulerPlacement {
  const shift = (p: Pt): Pt => ({ x: p.x - usable.x0, y: p.y - usable.y0 });
  const localBlockers = blockers.map((poly) => poly.map(shift));
  const local = pickRuler(usable.x1 - usable.x0, usable.y1 - usable.y0, localBlockers);
  return {
    vertical: local.vertical,
    box: {
      x0: local.box.x0 + usable.x0,
      y0: local.box.y0 + usable.y0,
      x1: local.box.x1 + usable.x0,
      y1: local.box.y1 + usable.y0,
    },
  };
}

export function tileSheetSvg(input: TileSheetInput): string {
  const { face, plan, tile, partNo, nameZh, qty } = input;
  const faceCount = input.faceCount ?? 1;
  const faceIndex = input.faceIndex ?? 0;
  const g = tilePageGeometry(plan, tile);
  const { pageW, pageH, tx, ty, usable, leftX, topY, rightX, bottomY, hasLeft, hasRight, hasTop, hasBottom } = g;

  const clipId = `tileclip-${partNo}-${tile.c}-${tile.r}`.replace(/[^A-Za-z0-9_-]/g, "_");

  // 內容：輪廓、公榫、孔、以及整組對角自檢線。跟 outline 用同一組 translate + clip，
  // 貼完之後這條線如果是直的，代表整組貼對了；有一張錯位或轉向，線會明顯歪掉。
  const geometry = [
    `<path d="${outlinePathD(face.outline)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}"/>`,
    ...(face.tenons ?? []).map(
      (tn) =>
        `<path d="${outlinePathD(tn.pts)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}"><title>${esc(tn.label + "（公榫）")}</title></path>`,
    ),
    ...face.holes.map(holeMarkup),
    `<line data-mark="diagonal-check" x1="0" y1="0" x2="${r2(face.w)}" y2="${r2(face.h)}"` +
      ` stroke="${DIAGONAL_COLOR}" stroke-width="0.15"/>`,
  ].join("\n    ");

  // 這張實際會畫出內容的範圍（face 轉到紙面座標後跟可用區的交集）——資訊區塊
  // 跟證明尺都要避開它，不然壓在輪廓線上（方凳凳腳 35mm 寬的窄零件最容易踩到）。
  const contentBox: Box = {
    x0: Math.min(Math.max(tx, usable.x0), usable.x1),
    y0: Math.min(Math.max(ty, usable.y0), usable.y1),
    x1: Math.min(Math.max(tx + face.w, usable.x0), usable.x1),
    y1: Math.min(Math.max(ty + face.h, usable.y0), usable.y1),
  };

  // 格子編號＋箭頭＋件名。四角挑一個不撞內容的（見 pickInfoCorner）。
  const gridCode = `${colLetter(tile.c)}${tile.r + 1}`;
  const countsText = `共 ${plan.cols} 欄 × ${plan.rows} 列`;
  const nameLines = [`${partNo} ${nameZh}${qty > 1 ? ` ×${qty}` : ""}　【${face.faceLabelZh}】`];
  if (faceCount > 1) nameLines.push(`第 ${faceIndex + 1} 面 / 共 ${faceCount} 面`);

  const ARROW_COL_W = 9;
  const headerW = ARROW_COL_W + Math.max(estTextWidthMm(gridCode, 9), estTextWidthMm(countsText, 3.5));
  const nameW = Math.max(...nameLines.map((l) => estTextWidthMm(l, 4)));
  const blockW = Math.max(headerW, nameW) + 3;
  const blockH = 19 + nameLines.length * 5;
  const infoPos = pickInfoCorner(usable, blockW, blockH, contentBox);
  const infoX = infoPos.x0;
  const infoTop = infoPos.y0 + 8;

  const infoBlock = [
    upArrowMarkup(infoX + ARROW_COL_W / 2, infoPos.y0 + 0.5),
    `<text x="${r2(infoX + ARROW_COL_W)}" y="${r2(infoTop)}" font-family="PackCJK" font-size="9"` +
      ` font-weight="700" fill="#000" text-anchor="start">${esc(gridCode)}</text>`,
    `<text x="${r2(infoX + ARROW_COL_W)}" y="${r2(infoTop + 5)}" font-family="PackCJK" font-size="3.5"` +
      ` font-weight="400" fill="#000" text-anchor="start">${esc(countsText)}</text>`,
    ...nameLines.map(
      (l, i) =>
        `<text x="${r2(infoX)}" y="${r2(infoTop + 11 + i * 5)}" font-family="PackCJK" font-size="4"` +
        ` font-weight="700" fill="#000" text-anchor="start">${esc(l)}</text>`,
    ),
  ].join("\n  ");
  const infoBox: Box = { x0: infoPos.x0, y0: infoPos.y0, x1: infoPos.x0 + blockW, y1: infoPos.y0 + blockH };

  // 裁切線／對齊線
  const seams: string[] = [];
  if (hasRight) seams.push(cutLineMarkup(true, rightX, usable.y0, usable.y1));
  if (hasBottom) seams.push(cutLineMarkup(false, bottomY, usable.x0, usable.x1));
  if (hasLeft) seams.push(alignLineMarkup(true, leftX, usable.y0, usable.y1));
  if (hasTop) seams.push(alignLineMarkup(false, topY, usable.x0, usable.x1));

  // 四角對位十字——固定在四角，不做內容碰撞迴避（跟裁切線/對齊線同層級的頁面骨架，
  // 本來就該永遠在同一個位置，才有「同一組十字」可對）。
  const registers = [
    registerCross(leftX, topY),
    registerCross(rightX, topY),
    registerCross(leftX, bottomY),
    registerCross(rightX, bottomY),
  ].join("\n  ");

  // 證明尺：blockers 用內容範圍加資訊區塊，沿用 sheet.ts 的 pickRuler／rulerMarkup，
  // 跟單張樣板同一套視覺語言。
  const blockers: Poly[] = [boxPoly(contentBox), boxPoly(infoBox)];
  const ruler = pickRulerInFrame(usable, blockers);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`,
    `  <defs><clipPath id="${clipId}"><rect x="${r2(usable.x0)}" y="${r2(usable.y0)}" width="${r2(usable.x1 - usable.x0)}" height="${r2(usable.y1 - usable.y0)}"/></clipPath></defs>`,
    `  <g clip-path="url(#${clipId})">`,
    `    <g transform="translate(${r2(tx)} ${r2(ty)})">`,
    `      ${geometry}`,
    `    </g>`,
    `  </g>`,
    `  ${infoBlock}`,
    ...seams.map((s) => `  ${s}`),
    `  ${registers}`,
    `  ${rulerMarkup(ruler)}`,
    `</svg>`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 印表機測試頁
// ---------------------------------------------------------------------------

/**
 * A4 拼接整包的第一張，檔名要排在索引之前（見 pack.ts）——先花一張紙驗證印表機，
 * 不要印完 N 張才發現全部歪掉。內容：15mm 內縮框（跟每張拼接紙同一個
 * TILE_MARGIN_MM）、四角角標（跟樣板同一顆 registerCross）、100mm 證明尺、
 * 操作說明。固定橫放，不用管特定零件的 face，所以不需要 clip／translate。
 */
export function printerTestPageSvg(sheetCount: number): string {
  const pageW = A4.w;
  const pageH = A4.h;
  const margin = TILE_MARGIN_MM;
  const usable: Box = { x0: margin, y0: margin, x1: pageW - margin, y1: pageH - margin };

  const frame =
    `<rect data-mark="test-frame" x="${r2(usable.x0)}" y="${r2(usable.y0)}"` +
    ` width="${r2(usable.x1 - usable.x0)}" height="${r2(usable.y1 - usable.y0)}"` +
    ` fill="none" stroke="#000" stroke-width="${SEAM_STROKE_MM}"/>`;

  const corners = [
    registerCross(usable.x0, usable.y0),
    registerCross(usable.x1, usable.y0),
    registerCross(usable.x0, usable.y1),
    registerCross(usable.x1, usable.y1),
  ].join("\n  ");

  // 這頁沒有零件內容，說明文字集中在左上角、外框跟角標都貼在 usable 邊緣，
  // pickRuler 本來就會找退讓過的角落，不需要額外 blocker。
  const ruler = pickRulerInFrame(usable, []);

  const title = (x: number, y: number, size: number, s: string) =>
    `<text x="${r2(x)}" y="${r2(y)}" font-family="PackCJK" font-size="${size}"` +
    ` font-weight="700" fill="#000" text-anchor="start">${esc(s)}</text>`;
  const body = (x: number, y: number, s: string) =>
    `<text x="${r2(x)}" y="${r2(y)}" font-family="PackCJK" font-size="4.2"` +
    ` font-weight="400" fill="#000" text-anchor="start">${esc(s)}</text>`;

  const tx = usable.x0 + 6;
  let ty = usable.y0 + 12;
  const texts: string[] = [];
  texts.push(title(tx, ty, 8, "先只印這一張"));
  ty += 10;
  texts.push(
    body(tx, ty, "① 拿尺量下面那條線，必須剛好 100mm。不是的話，列印設定選「實際大小 / 100%」，"),
  );
  ty += 6;
  texts.push(body(tx, ty, "　不要選「縮放至頁面大小」，再印一次。"));
  ty += 9;
  texts.push(body(tx, ty, "② 檢查四個角的記號有沒有完整印出來。缺角代表你的印表機邊界比較大，"));
  ty += 6;
  texts.push(body(tx, ty, "　請改用其他印表機，或回報給我們。"));
  ty += 10;
  texts.push(title(tx, ty, 6, `兩項都通過，再印其餘 ${sheetCount} 張。`));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`,
    `  ${frame}`,
    `  ${corners}`,
    ...texts.map((t) => `  ${t}`),
    `  ${rulerMarkup(ruler)}`,
    `</svg>`,
    "",
  ].join("\n");
}
