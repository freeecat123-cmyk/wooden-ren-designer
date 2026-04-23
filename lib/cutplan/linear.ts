import type { CutPiece, LinearBin, LinearGroup } from "./types";

/**
 * 1D First-Fit-Decreasing：把一組同橫截面的零件排到原料上。
 *
 * 策略：
 * 1. 零件依長度遞減排序
 * 2. 用「虛擬最大支」裝，能疊就疊（FFD）
 * 3. 全部排完後，每支 bin 挑「可用長度中 >= usedLength 的最小一支、且庫存還有的」
 * 4. 庫存 counts：值 <= 0 或沒列 = 不限
 * 5. 某個 bin 找不到可用長度（全庫存用完）→ 該 bin 的零件全進 unplaced
 */
export function packLinear(
  material: string,
  width: number,
  thickness: number,
  pieces: CutPiece[],
  allowedStockLengths: number[],
  counts: Record<number, number>,
  kerf: number,
  minWasteMm: number,
): LinearGroup {
  const sortedAsc = [...allowedStockLengths].sort((a, b) => a - b);
  const maxStock = sortedAsc[sortedAsc.length - 1] ?? 0;

  // 1. FFD 用虛擬最大支
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  const virtualBins: LinearBin[] = [];
  for (const piece of sorted) {
    if (piece.length > maxStock) {
      virtualBins.push({
        stockLength: piece.length,
        width,
        thickness,
        pieces: [{ piece, startMm: 0 }],
        usedLength: piece.length,
      });
      continue;
    }
    let placed = false;
    for (const bin of virtualBins) {
      const addKerf = bin.pieces.length > 0 ? kerf : 0;
      if (bin.usedLength + addKerf + piece.length <= bin.stockLength) {
        bin.pieces.push({ piece, startMm: bin.usedLength + addKerf });
        bin.usedLength += addKerf + piece.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      virtualBins.push({
        stockLength: maxStock,
        width,
        thickness,
        pieces: [{ piece, startMm: 0 }],
        usedLength: piece.length,
      });
    }
  }

  // 2. 分配實際原料長度：bin 由大到小（大的先搶大尺寸原料），每支挑最小裝得下的
  const remaining: Record<number, number | null> = {};
  for (const L of sortedAsc) {
    const c = counts[L];
    remaining[L] = c && c > 0 ? c : null;
  }

  const finalBins: LinearBin[] = [];
  const unplaced: CutPiece[] = [];
  const sortedBins = [...virtualBins].sort((a, b) => b.usedLength - a.usedLength);

  for (const bin of sortedBins) {
    // 超長件（比最大支還長）直接保留
    if (bin.usedLength > maxStock) {
      finalBins.push(bin);
      continue;
    }
    let assigned = false;
    for (const L of sortedAsc) {
      if (L < bin.usedLength) continue;
      const left = remaining[L];
      if (left === null) {
        bin.stockLength = L;
        finalBins.push(bin);
        assigned = true;
        break;
      }
      if (left > 0) {
        remaining[L] = left - 1;
        bin.stockLength = L;
        finalBins.push(bin);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      // 庫存用完：這支 bin 的零件全算排不下
      for (const { piece } of bin.pieces) unplaced.push(piece);
    }
  }

  // 利用率
  let usedTotal = 0;
  let denomTotal = 0;
  for (const bin of finalBins) {
    const pieceLen = bin.pieces.reduce((s, p) => s + p.piece.length, 0);
    usedTotal += pieceLen;
    const waste = bin.stockLength - bin.usedLength;
    const countable = waste >= minWasteMm ? bin.stockLength : bin.stockLength - waste;
    denomTotal += countable;
  }

  return {
    material: material as LinearGroup["material"],
    width,
    thickness,
    pieces,
    bins: finalBins,
    utilization: denomTotal > 0 ? usedTotal / denomTotal : 0,
    unplaced,
  };
}
