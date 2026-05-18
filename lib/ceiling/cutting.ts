/**
 * 1D 裁切最佳化(First Fit Decreasing,角材用)
 *
 * 把所有需要的角材切割段,排進「stock 長度」的角材原料中,最小化所需 stock 數量。
 * FFD 是 O(n log n),貪婪但接近最佳(大多數案場下 stock 數量不會比真最佳多 11%)。
 *
 * 鋸 kerf:同一根 stock 內每多切一段,需扣 sawKerfCm(實務 ~3 mm)。
 *
 * 不適用 2D(矽酸鈣板),板的計算在 calc.ts §CE.7。
 */

import type { CeilingBom } from "./types";

export interface CuttingPiece {
  /** 顯示用標籤 (例 "主支 312.8 cm") */
  label: string;
  /** 切割長度(cm) */
  lengthCm: number;
  /** 類別(顯示用 tone) */
  category: "frame" | "main-joist" | "sub-joist" | "hanger";
}

export interface CuttingStock {
  /** stock 編號(從 1) */
  index: number;
  /** stock 原始長度 */
  stockLengthCm: number;
  /** 該 stock 裡的切割段 */
  pieces: CuttingPiece[];
  /** 同 stock 內已切總長(不含 kerf) */
  usedLengthCm: number;
  /** 同 stock 內鋸口總損 */
  totalKerfCm: number;
  /** 剩料(廢料,可能變短料或回收) */
  remainCm: number;
}

export interface CuttingPlan {
  stockLengthCm: number;
  sawKerfCm: number;
  spliceOverlapCm: number;
  /** 輸入的切割段(已展開,1 件 1 entry) */
  inputPieces: CuttingPiece[];
  /** stocks 排版結果 */
  stocks: CuttingStock[];
  /** 總計 */
  summary: {
    stockCount: number;
    totalStockLengthM: number;
    totalUsedM: number;        // 實際吃料(含 kerf)
    totalRemainM: number;
    utilizationPct: number;    // 利用率 = used / (stockCount × stockLength)
  };
}

/**
 * 從 BOM 展開角材切割清單(每件 1 entry)
 * 矽酸鈣板不展開(2D 不適用)。
 */
export function bomToCuttingPieces(bom: CeilingBom): CuttingPiece[] {
  const pieces: CuttingPiece[] = [];

  for (const item of bom.items) {
    switch (item.category) {
      case "frame": {
        // 邊框 = 4 段(上下沿長邊各 1 + 左右沿短邊各 1)
        // 切料時可能需從 stock 拼,但先以 4 段獨立呈現
        const L = bom.input.longSideCm;
        const S = bom.input.shortSideCm;
        pieces.push({ label: `邊框 上 ${L}cm`, lengthCm: L, category: "frame" });
        pieces.push({ label: `邊框 下 ${L}cm`, lengthCm: L, category: "frame" });
        pieces.push({ label: `邊框 左 ${S}cm`, lengthCm: S, category: "frame" });
        pieces.push({ label: `邊框 右 ${S}cm`, lengthCm: S, category: "frame" });
        break;
      }
      case "main-joist":
      case "sub-joist": {
        const len = item.unitLengthCm ?? 0;
        if (len <= 0) continue;
        for (let i = 0; i < item.count; i++) {
          pieces.push({
            label: `${item.nameZh} ${len}cm`,
            lengthCm: len,
            category: item.category,
          });
        }
        break;
      }
      case "hanger": {
        const len = item.unitLengthCm ?? 0;
        if (len <= 0) continue;
        for (let i = 0; i < item.count; i++) {
          pieces.push({
            label: `吊筋 ${len}cm`,
            lengthCm: len,
            category: "hanger",
          });
        }
        break;
      }
      // board-full / board-cut 跳過(2D 不適用)
    }
  }

  return pieces;
}

/**
 * 拼接前處理:超 stock 段自動切多段拼接,每段間加 spliceOverlapCm 重疊
 * (實務拼接需 ~10 cm 重疊放邊框上強固)。回傳新 piece 陣列,每段標 (拼 i/N)。
 */
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
    // 切法:前 N-1 段用 stockLength,最後一段 = 剩餘 + (N-1) × overlap
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

/**
 * First Fit Decreasing 裝箱
 *
 * 處理流程:
 *   0. 預處理:超 stock 段切多段拼接(spliceOverlapCm 預設 10 cm)
 *   1. 把所有 pieces 依長度降冪排序
 *   2. 對每件 piece,從現有 stocks 找第一個放得下的(含 kerf)
 *   3. 找不到 → 開新 stock
 */
export function computeCuttingPlan(
  pieces: CuttingPiece[],
  stockLengthCm: number,
  sawKerfCm: number,
  spliceOverlapCm: number = 10,
): CuttingPlan {
  // 預處理拼接
  const splitPieces = splitLongPieces(pieces, stockLengthCm, spliceOverlapCm);
  const sorted = [...splitPieces].sort((a, b) => b.lengthCm - a.lengthCm);
  const stocks: CuttingStock[] = [];

  for (const piece of sorted) {
    // 拼接後仍超 stock(極端 case,例如 spliceOverlap > stockLength):單獨放
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

    // 找放得下的 stock
    let placed = false;
    for (const stock of stocks) {
      // 新增此 piece 需要的空間 = piece.length + kerf(如果同 stock 已有件)
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
  const totalUsedCm = stocks.reduce((s, st) => s + st.usedLengthCm + st.totalKerfCm, 0);
  const totalRemainCm = stocks.reduce((s, st) => s + Math.max(0, st.remainCm), 0);

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
      utilizationPct: totalStockLengthCm > 0
        ? Math.round((totalUsedCm / totalStockLengthCm) * 1000) / 10
        : 0,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
