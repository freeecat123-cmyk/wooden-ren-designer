import type { CutPiece, LinearBin, LinearGroup } from "./types";

/**
 * 1D First-Fit-Decreasing：把一組同橫截面的零件排到原料上。
 *
 * 策略：
 * 1. 零件依長度遞減排序
 * 2. 每件依序塞進現有 bin；放不下就開新 bin（用最大允許原料長）
 * 3. 全部排完後，把每個 bin 的 stockLength 縮到「剛好塞得下用量的最小可用長度」
 *    （真實店裡會切到實際用到的長度，不是都用 8 尺料）
 */
export function packLinear(
  material: string,
  width: number,
  thickness: number,
  pieces: CutPiece[],
  allowedStockLengths: number[],
  kerf: number,
): LinearGroup {
  const maxStock = Math.max(...allowedStockLengths);
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  const bins: LinearBin[] = [];

  for (const piece of sorted) {
    if (piece.length > maxStock) {
      // 零件比所有原料都長——開一個「超長」bin 標記起來，避免演算法爆掉
      bins.push({
        stockLength: piece.length,
        width,
        thickness,
        pieces: [{ piece, startMm: 0 }],
        usedLength: piece.length,
      });
      continue;
    }
    let placed = false;
    for (const bin of bins) {
      const addKerf = bin.pieces.length > 0 ? kerf : 0;
      if (bin.usedLength + addKerf + piece.length <= bin.stockLength) {
        bin.pieces.push({ piece, startMm: bin.usedLength + addKerf });
        bin.usedLength += addKerf + piece.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push({
        stockLength: maxStock,
        width,
        thickness,
        pieces: [{ piece, startMm: 0 }],
        usedLength: piece.length,
      });
    }
  }

  // 縮 stockLength：每個 bin 用「>= usedLength 的最小允許長度」
  const sortedStocks = [...allowedStockLengths].sort((a, b) => a - b);
  for (const bin of bins) {
    const fit = sortedStocks.find((s) => s >= bin.usedLength);
    if (fit !== undefined && fit < bin.stockLength) {
      bin.stockLength = fit;
    }
  }

  const totalStock = bins.reduce((s, b) => s + b.stockLength, 0);
  const totalUsed = bins.reduce(
    (s, b) => s + b.pieces.reduce((ss, p) => ss + p.piece.length, 0),
    0,
  );

  return {
    material: material as LinearGroup["material"],
    width,
    thickness,
    pieces,
    bins,
    utilization: totalStock > 0 ? totalUsed / totalStock : 0,
  };
}
