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
