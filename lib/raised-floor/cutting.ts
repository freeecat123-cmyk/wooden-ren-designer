/**
 * /raised-floor 裁切表 — 兩張表:
 *   1. 骨架(joist) 1D FFD 裁切 — 對標 lib/ceiling/cutting.ts
 *      展開 BOM 為每件 1 entry 的 piece list,套 First Fit Decreasing 排進 stock。
 *      pieces:頂框邊 + 底框邊 + 頂主支 + 底主支(只有內柱排)+ 副支
 *   2. 地板片(plank) — 重用 lib/floor 的 layout.planks(全片 + 裁切片)+
 *      餘料再利用紀錄(offcutReuseLog)
 *
 * 公式參考 lib/ceiling/cutting.ts(FFD + 鋸口扣損 + 拼接搭接);這裡只重寫
 * piece 展開器,演算法部分照搬。
 */

import type { RaisedFloorBom } from "./types";
import { bbox, scanlineLength, subJoistRunLengthsM } from "./geometry";

const LEG_MAX_SPACING_CM = 80; // 跟 RaisedFloorScene3D 同步

// ─────────────────────────────────────────────────────────
// 夾板拼法 — 從 RaisedFloorOverviewSvg 抽出來共用(2D SVG + 裁切表)
// 邏輯:接縫吸最近骨架中心(對標 ceiling)、只往內吸、整片 ±15% 容差
// ─────────────────────────────────────────────────────────
export interface PlywoodSheet {
  /** bbox-local 左上角座標(cm) */
  x: number;
  y: number;
  /** 片寬(沿 X,cm) */
  w: number;
  /** 片高(沿 Z,cm) */
  h: number;
  /** 是否為整片下料(snap 後仍接近 nominal) */
  isFull: boolean;
  /** 整批序號(從 1) */
  index: number;
  /** 棋盤交錯(0/1)— SVG 視覺用 */
  parity: 0 | 1;
  /** 這片來自哪一張「新料」(1-based);餘料配對後同號 = 同張新料 */
  orderSheetIndex?: number;
}

export interface PlywoodLayout {
  sheets: PlywoodSheet[];
  fullCount: number;
  cutCount: number;
  /** 全部 cut 片面積總和(cm²)— 估算實耗 */
  cutUsedAreaCm2: number;
  /** Sheet 尺寸資訊 */
  sheetLongX: number;
  sheetShortZ: number;
  /** 實際要訂的「新料張數」(2D shelf packing 後)— 跟 sheets.length 不同,
   *  小塊裁切片可以從整片下料的同一張新料剩餘區拼出。*/
  orderSheetCount: number;
  /** 餘料拼湊紀錄(人類可讀) */
  packingLog: string[];
}

export function computePlywoodLayout(bom: RaisedFloorBom): PlywoodLayout {
  const { input, platform } = bom;
  const bb = bbox(platform);
  const W = bb.maxX - bb.minX;
  const D = bb.maxY - bb.minY;
  const shortAlongX = W <= D;
  const shortSpan = shortAlongX ? W : D;

  const sheetLongX = input.plywood.sheetWidthCm;
  const sheetShortZ = input.plywood.sheetLengthCm;

  // 主支中心(長軸座標)
  const mainCentersCm = bom.trace.mainJoistCentersCm;

  // 副支對齊夾板:用 aligned = plywoodLongCm/N 為間距,從 0 起算
  const subCentersCm = (() => {
    const target = Math.max(input.subJoistSpacingCm, 10);
    const plyLong = input.plywood.sheetWidthCm;
    const aligned =
      plyLong > 0 ? plyLong / Math.max(2, Math.round(plyLong / target)) : target;
    const out: number[] = [];
    let pos = aligned;
    while (pos < shortSpan - 0.5) {
      out.push(pos);
      pos += aligned;
    }
    return out;
  })();

  const mainSnapTol = Math.max(input.joistSpacingCm * 0.6, 15);
  const subSnapTol = Math.max(input.subJoistSpacingCm * 0.6, 15);

  const snapDownTo = (target: number, candidates: number[], tol: number): number => {
    let best = target;
    let bestDist = tol;
    for (const c of candidates) {
      if (c > target + 0.5) continue;
      const d = target - c;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  };

  // shortAlongX=true: X 方向吸副支、Z 方向吸主支
  const xSnapCenters = shortAlongX ? subCentersCm : mainCentersCm;
  const xSnapTol = shortAlongX ? subSnapTol : mainSnapTol;
  const zSnapCenters = shortAlongX ? mainCentersCm : subCentersCm;
  const zSnapTol = shortAlongX ? mainSnapTol : subSnapTol;

  const buildEdges = (
    span: number,
    sheetSide: number,
    centers: number[],
    tol: number,
  ): number[] => {
    const edges: number[] = [0];
    let cursor = sheetSide;
    while (cursor < span - 1) {
      const snapped = centers.length > 0 ? snapDownTo(cursor, centers, tol) : cursor;
      if (snapped > edges[edges.length - 1] + 1) {
        edges.push(snapped);
        cursor = snapped + sheetSide;
      } else {
        cursor += sheetSide;
      }
    }
    if (edges[edges.length - 1] < span - 0.5) edges.push(span);
    return edges;
  };

  // Polygon 內部判定(挨柱 / L 形挖空跳過)
  const isInside = (px: number, py: number) => {
    let inside = false;
    const v = platform.vertices;
    const ox = bb.minX, oy = bb.minY;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const xi = v[i].x - ox, yi = v[i].y - oy;
      const xj = v[j].x - ox, yj = v[j].y - oy;
      const cross =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (cross) inside = !inside;
    }
    return inside;
  };

  const xEdges = buildEdges(W, sheetLongX, xSnapCenters, xSnapTol);
  const zEdges = buildEdges(D, sheetShortZ, zSnapCenters, zSnapTol);

  const FULL_TOL_X = sheetLongX * 0.15;
  const FULL_TOL_Z = sheetShortZ * 0.15;
  const sheets: PlywoodSheet[] = [];
  let counter = 0;
  let fullCount = 0;
  let cutCount = 0;
  let cutUsedAreaCm2 = 0;

  for (let i = 0; i + 1 < xEdges.length; i++) {
    const xL = xEdges[i], xR = xEdges[i + 1];
    for (let j = 0; j + 1 < zEdges.length; j++) {
      const zL = zEdges[j], zR = zEdges[j + 1];
      // 5 點採樣:中心 + 4 內縮角。任一在 polygon 內就保留(SVG clipPath 視覺裁切挨柱)。
      // 避免被中心點剛好落在挨柱裡而整片過濾(留下「L 形」cell 由 clipPath 處理)。
      const EPS_S = 1;
      const cxr = (xL + xR) / 2;
      const cyr = (zL + zR) / 2;
      const anyIn =
        isInside(cxr, cyr) ||
        isInside(xL + EPS_S, zL + EPS_S) ||
        isInside(xR - EPS_S, zL + EPS_S) ||
        isInside(xL + EPS_S, zR - EPS_S) ||
        isInside(xR - EPS_S, zR - EPS_S);
      if (!anyIn) continue;
      const cw = xR - xL;
      const ch = zR - zL;
      const isFull =
        Math.abs(cw - sheetLongX) < FULL_TOL_X &&
        Math.abs(ch - sheetShortZ) < FULL_TOL_Z;
      counter += 1;
      if (isFull) fullCount += 1;
      else {
        cutCount += 1;
        cutUsedAreaCm2 += cw * ch;
      }
      sheets.push({
        x: xL,
        y: zL,
        w: cw,
        h: ch,
        isFull,
        index: counter,
        parity: ((i + j) % 2) as 0 | 1,
      });
    }
  }

  // 2D shelf packing — 估算實際要訂的新料張數
  // 演算法:每張新料初始狀態 = 一張未切;每個 cell 先試「能否塞進現有張的剩餘區」,
  // 不行就開新張。剩餘區用 guillotine 切後留下的最大殘塊維護(簡化:存可用矩形列表)。
  const { orderSheetCount, packingLog, cellToSheetIdx } = packPlywoodSheets(
    sheets,
    sheetLongX,
    sheetShortZ,
  );
  // 把新料編號寫回 sheets 陣列(同號 = 同張新料切出來)
  for (const s of sheets) {
    s.orderSheetIndex = cellToSheetIdx.get(s.index);
  }

  return {
    sheets,
    fullCount,
    cutCount,
    cutUsedAreaCm2,
    sheetLongX,
    sheetShortZ,
    orderSheetCount,
    packingLog,
  };
}

interface FreeRect {
  /** 剩餘區寬(cm) */
  w: number;
  /** 剩餘區高(cm) */
  h: number;
}

/**
 * 2D guillotine shelf packing(贪婪 First-Fit Decreasing,簡化版):
 *   1. cells 按面積大到小排序
 *   2. 每片試 fit 進現有張的 freeRects(任一 rect 寬高都 ≥ cell)
 *   3. fit 到後切兩刀:水平切剩下底條 + 垂直切剩下右條(取面積較大的當主餘料)
 *   4. fit 不到開新張,加上切完該 cell 的兩條餘料
 *
 * 容差:cell 寬高分別 ≤ rect 寬高 + 0.5cm(snap 後的誤差吸收)
 */
function packPlywoodSheets(
  cells: { w: number; h: number; isFull: boolean; index: number }[],
  sheetW: number,
  sheetH: number,
): {
  orderSheetCount: number;
  packingLog: string[];
  /** cell.index → 1-based 新料編號(同號 = 同張新料) */
  cellToSheetIdx: Map<number, number>;
} {
  const sorted = [...cells].sort((a, b) => b.w * b.h - a.w * a.h);
  const sheetsFreeRects: FreeRect[][] = []; // 每張新料的剩餘區列表
  const log: string[] = [];
  const cellToSheetIdx = new Map<number, number>();

  const tryFit = (cell: { w: number; h: number }, sheetIdx: number): number => {
    const rects = sheetsFreeRects[sheetIdx];
    // best-fit:找面積最小但放得下的剩餘區(留大塊給之後用)
    let bestRectIdx = -1;
    let bestArea = Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (cell.w <= r.w + 0.5 && cell.h <= r.h + 0.5) {
        const area = r.w * r.h;
        if (area < bestArea) {
          bestArea = area;
          bestRectIdx = i;
        }
      }
    }
    return bestRectIdx;
  };

  for (const cell of sorted) {
    let placed = false;
    // 先試現有張
    for (let si = 0; si < sheetsFreeRects.length; si++) {
      const ri = tryFit(cell, si);
      if (ri >= 0) {
        const r = sheetsFreeRects[si][ri];
        // 切兩刀:水平先切(底條 = r.w × (r.h - cell.h))、垂直切(右條 = (r.w - cell.w) × cell.h)
        sheetsFreeRects[si].splice(ri, 1);
        const bottom: FreeRect = { w: r.w, h: Math.max(0, r.h - cell.h) };
        const right: FreeRect = { w: Math.max(0, r.w - cell.w), h: cell.h };
        if (bottom.h > 5 && bottom.w > 5) sheetsFreeRects[si].push(bottom);
        if (right.w > 5 && right.h > 5) sheetsFreeRects[si].push(right);
        if (!cell.isFull) {
          log.push(
            `#${cell.index} 裁切片 ${cell.w.toFixed(0)}×${cell.h.toFixed(0)}cm 從第 ${si + 1} 張餘料拼出`,
          );
        }
        cellToSheetIdx.set(cell.index, si + 1);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // 開新張,放這個 cell,切兩條餘料
      const idx = sheetsFreeRects.length;
      const bottom: FreeRect = { w: sheetW, h: Math.max(0, sheetH - cell.h) };
      const right: FreeRect = { w: Math.max(0, sheetW - cell.w), h: cell.h };
      const newSheet: FreeRect[] = [];
      if (bottom.h > 5 && bottom.w > 5) newSheet.push(bottom);
      if (right.w > 5 && right.h > 5) newSheet.push(right);
      sheetsFreeRects.push(newSheet);
      cellToSheetIdx.set(cell.index, idx + 1);
      log.push(
        `第 ${idx + 1} 張新料:放 #${cell.index} ${cell.isFull ? "整片" : "裁切"} ${cell.w.toFixed(0)}×${cell.h.toFixed(0)}cm`,
      );
    }
  }

  return {
    orderSheetCount: sheetsFreeRects.length,
    packingLog: log,
    cellToSheetIdx,
  };
}

export type CuttingCategory =
  | "frame-top"
  | "frame-bottom"
  | "main-joist"
  | "main-joist-bottom"
  | "sub-joist";

export interface CuttingPiece {
  label: string;
  lengthCm: number;
  category: CuttingCategory;
}

export interface CuttingStock {
  index: number;
  stockLengthCm: number;
  pieces: CuttingPiece[];
  usedLengthCm: number;
  totalKerfCm: number;
  remainCm: number;
}

export interface CuttingPlan {
  stockLengthCm: number;
  sawKerfCm: number;
  spliceOverlapCm: number;
  inputPieces: CuttingPiece[];
  stocks: CuttingStock[];
  summary: {
    stockCount: number;
    totalStockLengthM: number;
    totalUsedM: number;
    totalRemainM: number;
    utilizationPct: number;
  };
}

/**
 * 展開骨架 BOM 為每件 1 entry 的 piece 清單。
 *
 * 邊框 = 平台 polygon 每條邊(頂 + 底各一份);
 * 主支 = trace.mainJoistCentersCm 每根掃描線實長扣 2×frameWidth;
 * 底主支 = 內柱 row 位置(對齊 RaisedFloorScene3D 的 LEG_MAX_SPACING_CM grid);
 * 副支 = 每 slot × subRowsPerSlot,長 = slotWidth(扣框沒處理,因為副支已被主支夾)。
 */
export function bomToCuttingPieces(bom: RaisedFloorBom): CuttingPiece[] {
  const { input, platform, trace } = bom;
  const out: CuttingPiece[] = [];

  // ─── 頂框 / 底框:polygon 每條邊各一份 ───
  const verts = platform.vertices;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    out.push({
      label: `頂框 ${r1(len)}cm`,
      lengthCm: len,
      category: "frame-top",
    });
    out.push({
      label: `底框 ${r1(len)}cm`,
      lengthCm: len,
      category: "frame-bottom",
    });
  }

  // ─── 頂主支:每根掃描線實長扣兩端邊框寬 ───
  const bb = bbox(platform);
  const W = bb.maxX - bb.minX;
  const D = bb.maxY - bb.minY;
  const shortAlongX = W <= D;
  const frameTw = input.mainJoist.widthMm / 10;
  const subFrameMargin = frameTw; // 副支兩端也扣同寬框
  const baseAxis = shortAlongX ? bb.minY : bb.minX;

  for (const c of trace.mainJoistCentersCm) {
    const len = scanlineLength(platform, shortAlongX, baseAxis + c);
    const adjusted = Math.max(0, len - 2 * frameTw);
    if (adjusted < 1) continue;
    out.push({
      label: `頂主支 ${r1(adjusted)}cm`,
      lengthCm: adjusted,
      category: "main-joist",
    });
  }

  // ─── 底主支:跟 Scene3D 同步,只在「內柱 row」位置 ───
  // 內柱 row 沿長軸(shortAlongX=true → Z 軸),取 grid 1..n-2
  const longSpan = shortAlongX ? D : W;
  const legCountLong = Math.max(2, Math.ceil(longSpan / LEG_MAX_SPACING_CM) + 1);
  for (let i = 1; i < legCountLong - 1; i++) {
    const c = (i * longSpan) / (legCountLong - 1);
    const len = scanlineLength(platform, shortAlongX, baseAxis + c);
    const adjusted = Math.max(0, len - 2 * frameTw);
    if (adjusted < 1) continue;
    out.push({
      label: `底主支 ${r1(adjusted)}cm`,
      lengthCm: adjusted,
      category: "main-joist-bottom",
    });
  }

  // ─── 副支:每 slot 每排,長 = slotWidth − 2*frameTw(雖然副支被主支夾,
  // 但仍要扣兩端跟主支的搭接縫;簡化以 frame 寬為下限) ───
  // 用 subJoistRunLengthsM 拿到 typicalLengthCm(已經是 slotWidth);實際 slot 數
  // 從 mainJoistCenters 推。L 形/挨柱平台 slot 寬一樣假設恆等(估料允許略高估)。
  const subInfo = subJoistRunLengthsM(
    platform,
    trace.mainJoistCentersCm,
    input.subJoistSpacingCm,
  );
  if (subInfo.count > 0 && subInfo.typicalLengthCm > 0) {
    // 每根副支長 = typical slot 寬,扣兩端讓副支不撞主支
    const subLen = Math.max(0, subInfo.typicalLengthCm - 2 * subFrameMargin);
    if (subLen >= 1) {
      for (let i = 0; i < subInfo.count; i++) {
        out.push({
          label: `副支 ${r1(subLen)}cm`,
          lengthCm: subLen,
          category: "sub-joist",
        });
      }
    }
  }

  return out;
}

/** 超 stock 段自動切多段拼接,每段間加 spliceOverlapCm 重疊 */
export function splitLongPieces(
  pieces: CuttingPiece[],
  stockLengthCm: number,
  spliceOverlapCm: number,
): CuttingPiece[] {
  const result: CuttingPiece[] = [];
  for (const p of pieces) {
    if (p.lengthCm <= stockLengthCm) {
      result.push(p);
      continue;
    }
    const N = Math.ceil(p.lengthCm / stockLengthCm);
    for (let i = 0; i < N - 1; i++) {
      result.push({
        ...p,
        label: `${p.label} (拼${i + 1}/${N})`,
        lengthCm: stockLengthCm,
      });
    }
    const remainder =
      p.lengthCm - (N - 1) * stockLengthCm + (N - 1) * spliceOverlapCm;
    result.push({
      ...p,
      label: `${p.label} (拼${N}/${N})`,
      lengthCm: remainder,
    });
  }
  return result;
}

/** First Fit Decreasing 裝箱(對標 ceiling/cutting.ts) */
export function computeCuttingPlan(
  pieces: CuttingPiece[],
  stockLengthCm: number,
  sawKerfCm: number,
  spliceOverlapCm: number = 10,
): CuttingPlan {
  const splitPieces = splitLongPieces(pieces, stockLengthCm, spliceOverlapCm);
  const sorted = [...splitPieces].sort((a, b) => b.lengthCm - a.lengthCm);
  const stocks: CuttingStock[] = [];

  for (const piece of sorted) {
    if (piece.lengthCm > stockLengthCm) {
      stocks.push({
        index: stocks.length + 1,
        stockLengthCm,
        pieces: [piece],
        usedLengthCm: piece.lengthCm,
        totalKerfCm: 0,
        remainCm: stockLengthCm - piece.lengthCm,
      });
      continue;
    }

    let placed = false;
    for (const stock of stocks) {
      const additionalKerf = stock.pieces.length > 0 ? sawKerfCm : 0;
      const needed = piece.lengthCm + additionalKerf;
      if (stock.usedLengthCm + stock.totalKerfCm + needed <= stockLengthCm) {
        stock.pieces.push(piece);
        stock.usedLengthCm += piece.lengthCm;
        stock.totalKerfCm += additionalKerf;
        stock.remainCm = stockLengthCm - stock.usedLengthCm - stock.totalKerfCm;
        placed = true;
        break;
      }
    }
    if (!placed) {
      stocks.push({
        index: stocks.length + 1,
        stockLengthCm,
        pieces: [piece],
        usedLengthCm: piece.lengthCm,
        totalKerfCm: 0,
        remainCm: stockLengthCm - piece.lengthCm,
      });
    }
  }

  const totalStockLengthCm = stocks.length * stockLengthCm;
  const totalUsedCm = stocks.reduce(
    (s, st) => s + st.usedLengthCm + st.totalKerfCm,
    0,
  );
  const totalRemainCm = stocks.reduce(
    (s, st) => s + Math.max(0, st.remainCm),
    0,
  );

  return {
    stockLengthCm,
    sawKerfCm,
    spliceOverlapCm,
    inputPieces: splitPieces,
    stocks,
    summary: {
      stockCount: stocks.length,
      totalStockLengthM: round2(totalStockLengthCm / 100),
      totalUsedM: round2(totalUsedCm / 100),
      totalRemainM: round2(totalRemainCm / 100),
      utilizationPct:
        totalStockLengthCm > 0
          ? Math.round((totalUsedCm / totalStockLengthCm) * 1000) / 10
          : 0,
    },
  };
}

function r1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────
// CSV 匯出 — BOM 主表 + 三張裁切表攤平
// 對標 lib/ceiling/calc.ts bomToCsvRows
// ─────────────────────────────────────────────────────────
export function bomToCsvRows(
  bom: RaisedFloorBom,
  cuttingPlan: CuttingPlan,
  plywoodLayout: PlywoodLayout,
): string[][] {
  const out: string[][] = [];

  out.push(["和室架高平台 — 材料清單與裁切表"]);
  out.push([
    `平台 ${bom.input.widthCm}×${bom.input.depthCm}cm`,
    `高 ${bom.input.heightCm}cm`,
    `面積 ${bom.auto.platformAreaM2.toFixed(2)} m²`,
    `${bom.auto.pingShu.toFixed(2)} 坪`,
  ]);
  out.push([]);

  // 1. BOM 主表
  out.push(["━━ 材料清單 ━━"]);
  out.push(["類別", "名稱", "規格", "數量", "總長(m)", "備註", "小計(NT$)"]);
  for (const it of bom.items) {
    out.push([
      it.category,
      it.nameZh,
      it.spec,
      it.count != null ? String(it.count) : "",
      it.totalLengthM != null ? it.totalLengthM.toFixed(1) : "",
      it.note ?? "",
      it.subtotal != null ? String(Math.round(it.subtotal)) : "",
    ]);
  }
  out.push([
    "",
    "",
    "",
    "",
    "",
    "總計",
    bom.cost.total > 0 ? String(Math.round(bom.cost.total)) : "",
  ]);
  out.push([]);

  // 2. 骨架裁切表
  out.push(["━━ 裁切表 ① 骨架(1D FFD) ━━"]);
  out.push([
    `原料 ${cuttingPlan.stockLengthCm}cm/支 · 鋸路 ${cuttingPlan.sawKerfCm}cm · 接點搭接 ${cuttingPlan.spliceOverlapCm}cm`,
  ]);
  out.push([
    "支號",
    "切法(各段 cm)",
    "已用(cm)",
    "鋸路(cm)",
    "剩料(cm)",
  ]);
  for (const s of cuttingPlan.stocks) {
    out.push([
      `#${s.index}`,
      s.pieces.map((p) => `${p.category}:${r1(p.lengthCm)}`).join(" / "),
      r1(s.usedLengthCm).toString(),
      r1(s.totalKerfCm).toString(),
      r1(s.remainCm).toString(),
    ]);
  }
  out.push([
    "",
    `共 ${cuttingPlan.summary.stockCount} 支`,
    `${cuttingPlan.summary.totalUsedM} m`,
    "",
    `剩 ${cuttingPlan.summary.totalRemainM} m (利用率 ${cuttingPlan.summary.utilizationPct}%)`,
  ]);
  out.push([]);

  // 3. 地板裁切表
  out.push(["━━ 裁切表 ② 地板 ━━"]);
  out.push([
    `面材 ${bom.input.plankLengthCm}×${bom.input.plankWidthCm}cm · 整片 ${bom.trace.plankFullCount} + 裁切 ${bom.trace.plankCutCount}(實耗新片 ${bom.trace.plankCutNewCount})· 損耗 ${bom.trace.plankWastePercent.toFixed(1)}%`,
  ]);
  out.push(["編號", "類型", "有效長(cm)", "面積(cm²)"]);
  bom.layout.planks.forEach((p, i) => {
    out.push([
      `#${i + 1}`,
      p.kind === "full" ? "整片" : "裁切",
      r1(p.effectiveLengthCm).toString(),
      Math.round(p.usedAreaCm2).toString(),
    ]);
  });
  if (bom.trace.offcutReuseLog.length > 0) {
    out.push([]);
    out.push(["─ 餘料再利用明細 ─"]);
    for (const line of bom.trace.offcutReuseLog) out.push([line]);
  }
  out.push([]);

  // 4. 夾板裁切表
  out.push(["━━ 裁切表 ③ 夾板 ━━"]);
  out.push([
    `${bom.input.plywood.nameZh} · ${plywoodLayout.sheetLongX}×${plywoodLayout.sheetShortZ}cm · 平台需鋪 ${plywoodLayout.sheets.length} 片(整 ${plywoodLayout.fullCount} + 裁 ${plywoodLayout.cutCount})· 拼縫 ${bom.input.plywoodGapMm}mm`,
  ]);
  out.push([
    `實際訂料:${plywoodLayout.orderSheetCount} 張(2D 餘料拼湊後省 ${plywoodLayout.sheets.length - plywoodLayout.orderSheetCount} 張)`,
  ]);
  out.push(["編號", "類型", "寬(cm)", "高(cm)", "面積(cm²)"]);
  for (const s of plywoodLayout.sheets) {
    out.push([
      `#${s.index}`,
      s.isFull ? "整片" : "裁切",
      r1(s.w).toString(),
      r1(s.h).toString(),
      Math.round(s.w * s.h).toString(),
    ]);
  }
  if (plywoodLayout.packingLog.length > 0) {
    out.push([]);
    out.push(["─ 下料拼湊明細 ─"]);
    for (const line of plywoodLayout.packingLog) out.push([line]);
  }

  return out;
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function bomCsvString(rows: string[][]): string {
  // UTF-8 BOM(﻿)讓 Excel 開中文不亂碼
  return "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}
