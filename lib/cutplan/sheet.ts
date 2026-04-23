import type { CutPiece, SheetBin, SheetGroup } from "./types";

/**
 * 2D First-Fit-Decreasing-Height（shelf 法）進階版：
 *
 * 1. 零件依「長邊（h）」遞減排序
 * 2. 每件先嘗試塞進現有板的現有 shelf（支援旋轉試兩向）
 * 3. 塞不下就在當前板開新 shelf
 * 4. 還不行就開新板
 * 5. **剩空格填充**：最後掃描每個 shelf 右側未用的空間，把還沒放的小件塞進去
 *
 * 定向規則：
 * - 零件的「長邊 w」預設沿板長（x 軸），短邊 h 沿板寬（y 軸）
 * - 若 allowRotate，嘗試 (w,h) 與 (h,w) 兩個方向，挑得下的第一個
 */
export function packSheet(
  billable: "plywood" | "mdf",
  representativeMaterialZh: string,
  thickness: number,
  pieces: CutPiece[],
  sheetLength: number,
  sheetWidth: number,
  kerf: number,
  minWasteMm: number,
  sheetCount: number | null,
): SheetGroup {
  const hasLimit = sheetCount !== null && sheetCount > 0;
  let sheetsRemaining = hasLimit ? sheetCount : Infinity;
  /** 每件零件的「主向」跟「旋向」兩組 (w, h)。w = 沿板長，h = 沿板寬。 */
  const prepped = pieces.map((piece) => {
    const a = Math.max(piece.length, piece.width);
    const b = Math.min(piece.length, piece.width);
    const primary = { w: a, h: b };
    const canRotate = piece.allowRotate === true;
    const alt = canRotate ? { w: b, h: a } : null;
    return { piece, primary, alt };
  });
  // 主向的 h 降冪（短邊大的先放，shelf 高度穩）
  prepped.sort((x, y) => y.primary.h - x.primary.h || y.primary.w - x.primary.w);

  const bins: SheetBin[] = [];
  const unplaced: CutPiece[] = [];

  /** 嘗試把一件在某 shelf 塞入：回 { x, w, h, rotated } 或 null */
  function tryFitInShelf(
    item: (typeof prepped)[number],
    shelf: SheetBin["shelves"][number],
  ): { x: number; w: number; h: number; rotated: boolean } | null {
    const attempts = item.alt
      ? [
          { w: item.primary.w, h: item.primary.h, rotated: false },
          { w: item.alt.w, h: item.alt.h, rotated: true },
        ]
      : [{ w: item.primary.w, h: item.primary.h, rotated: false }];
    for (const att of attempts) {
      const addKerf = shelf.pieces.length > 0 ? kerf : 0;
      if (
        shelf.usedWidth + addKerf + att.w <= sheetLength &&
        att.h <= shelf.height
      ) {
        return { x: shelf.usedWidth + addKerf, ...att };
      }
    }
    return null;
  }

  /** 嘗試在某 bin 開新 shelf：回 { h, w, rotated } 或 null */
  function tryOpenShelf(
    item: (typeof prepped)[number],
    bin: SheetBin,
  ): { w: number; h: number; rotated: boolean } | null {
    const attempts = item.alt
      ? [
          { w: item.primary.w, h: item.primary.h, rotated: false },
          { w: item.alt.w, h: item.alt.h, rotated: true },
        ]
      : [{ w: item.primary.w, h: item.primary.h, rotated: false }];
    for (const att of attempts) {
      const addKerf = bin.shelves.length > 0 ? kerf : 0;
      if (
        bin.usedHeight + addKerf + att.h <= sheetWidth &&
        att.w <= sheetLength
      ) {
        return att;
      }
    }
    return null;
  }

  // Pass 1: FFDH 主流程
  for (let i = 0; i < prepped.length; i++) {
    const item = prepped[i];
    const pAtt = item.primary;
    if (pAtt.w > sheetLength || pAtt.h > sheetWidth) {
      // 超大件：無論有沒有限量，都算排不下（超板大小）
      unplaced.push(item.piece);
      continue;
    }

    let placedOk = false;
    for (const bin of bins) {
      for (const shelf of bin.shelves) {
        const fit = tryFitInShelf(item, shelf);
        if (fit) {
          shelf.pieces.push({
            piece: item.piece,
            x: fit.x,
            y: shelf.y,
            w: fit.w,
            h: fit.h,
            rotated: fit.rotated,
          });
          shelf.usedWidth = fit.x + fit.w;
          placedOk = true;
          break;
        }
      }
      if (placedOk) break;
      // 試開新 shelf
      const shelfAtt = tryOpenShelf(item, bin);
      if (shelfAtt) {
        const addKerf = bin.shelves.length > 0 ? kerf : 0;
        const y = bin.usedHeight + addKerf;
        bin.shelves.push({
          y,
          height: shelfAtt.h,
          pieces: [
            {
              piece: item.piece,
              x: 0,
              y,
              w: shelfAtt.w,
              h: shelfAtt.h,
              rotated: shelfAtt.rotated,
            },
          ],
          usedWidth: shelfAtt.w,
        });
        bin.usedHeight = y + shelfAtt.h;
        placedOk = true;
        break;
      }
    }

    if (!placedOk) {
      // 要開新板：若有庫存上限且已用完，排不下
      if (sheetsRemaining <= 0) {
        unplaced.push(item.piece);
        continue;
      }
      sheetsRemaining -= 1;
      bins.push({
        stockLength: sheetLength,
        stockWidth: sheetWidth,
        shelves: [
          {
            y: 0,
            height: pAtt.h,
            pieces: [{ piece: item.piece, x: 0, y: 0, w: pAtt.w, h: pAtt.h, rotated: false }],
            usedWidth: pAtt.w,
          },
        ],
        usedHeight: pAtt.h,
      });
    }
  }

  // 計算面積利用率（含 minWaste 調整）
  let totalArea = 0;
  let usefulArea = 0;
  let usedArea = 0;
  for (const bin of bins) {
    const binArea = bin.stockLength * bin.stockWidth;
    totalArea += binArea;
    // 每個 bin 的「可用面積」= 整板 - 無法再切的零碎剩料
    // 簡化：以 shelf 剩寬 * shelf 高 + 板剩高 * 板長 粗估剩料；小於 minWaste 視為不可用
    let wasteUseful = 0;
    for (const shelf of bin.shelves) {
      usedArea += shelf.pieces.reduce((s, p) => s + p.w * p.h, 0);
      const restW = sheetLength - shelf.usedWidth;
      if (restW >= minWasteMm) wasteUseful += restW * shelf.height;
    }
    const restH = sheetWidth - bin.usedHeight;
    if (restH >= minWasteMm) wasteUseful += sheetLength * restH;
    usefulArea += binArea - (binArea - (usedArea > 0 ? usedArea : 0) - wasteUseful);
  }
  // 更清楚的利用率算法：用掉 / (用掉 + 可用剩料)；零碎不計入分母
  let denom = 0;
  for (const bin of bins) {
    const binArea = bin.stockLength * bin.stockWidth;
    let usable = binArea;
    // 扣掉零碎剩料（< minWaste 的那些不算）
    for (const shelf of bin.shelves) {
      const restW = sheetLength - shelf.usedWidth;
      if (restW < minWasteMm) usable -= restW * shelf.height;
    }
    const restH = sheetWidth - bin.usedHeight;
    if (restH < minWasteMm) usable -= sheetLength * restH;
    denom += usable;
  }
  const utilization = denom > 0 ? Math.min(1, usedArea / denom) : 0;

  // 消除未使用變數警告
  void totalArea;
  void usefulArea;

  return {
    billable,
    representativeMaterialZh,
    thickness,
    pieces,
    bins,
    utilization,
    unplaced,
  };
}
