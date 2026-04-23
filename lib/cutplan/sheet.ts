import type { CutPiece, SheetBin, SheetGroup } from "./types";

/**
 * 2D First-Fit-Decreasing-Height（shelf 法）：把同厚度的板材零件排到整張板上。
 *
 * 每件零件定向成「長邊 → 沿板長方向 (x)、短邊 → 沿板寬方向 (y)」，方便
 * 讀圖。若零件可以沿寬邊擺也接受（預設不翻轉，纖維方向不混）。
 *
 * Shelf 法：
 * - 板長方向 (x) 是「shelf 的寬度軸」。
 * - 板寬方向 (y) 由下往上堆 shelf；每個 shelf 高 = 該 shelf 最高零件。
 * - 零件依短邊（h）遞減排序，每件塞第一個夠寬又夠高的 shelf；塞不下就
 *   在當前板的剩餘高度開新 shelf；還不行就開新板。
 */
export function packSheet(
  billable: "plywood" | "mdf",
  representativeMaterialZh: string,
  thickness: number,
  pieces: CutPiece[],
  sheetLength: number,
  sheetWidth: number,
  kerf: number,
): SheetGroup {
  /** 把零件定向：長邊當 w（沿板長），短邊當 h（沿板寬） */
  const oriented = pieces.map((p) => {
    const a = Math.max(p.length, p.width);
    const b = Math.min(p.length, p.width);
    return { piece: p, w: a, h: b };
  });
  // 依 h 降冪（shelf 法經典排序）
  oriented.sort((x, y) => y.h - x.h || y.w - x.w);

  const bins: SheetBin[] = [];

  for (const { piece, w, h } of oriented) {
    if (w > sheetLength || h > sheetWidth) {
      // 比整板都大——直接給一個特殊超寬 bin 避免當機
      bins.push({
        stockLength: w,
        stockWidth: h,
        shelves: [
          {
            y: 0,
            height: h,
            pieces: [{ piece, x: 0, y: 0, w, h }],
            usedWidth: w,
          },
        ],
        usedHeight: h,
      });
      continue;
    }

    let placed = false;
    for (const bin of bins) {
      for (const shelf of bin.shelves) {
        const addKerf = shelf.pieces.length > 0 ? kerf : 0;
        if (
          shelf.usedWidth + addKerf + w <= sheetLength &&
          h <= shelf.height
        ) {
          const x = shelf.usedWidth + addKerf;
          shelf.pieces.push({ piece, x, y: shelf.y, w, h });
          shelf.usedWidth = x + w;
          placed = true;
          break;
        }
      }
      if (placed) break;
      // 當前板試開新 shelf
      const addKerf = bin.shelves.length > 0 ? kerf : 0;
      if (bin.usedHeight + addKerf + h <= sheetWidth) {
        const y = bin.usedHeight + addKerf;
        bin.shelves.push({
          y,
          height: h,
          pieces: [{ piece, x: 0, y, w, h }],
          usedWidth: w,
        });
        bin.usedHeight = y + h;
        placed = true;
      }
      if (placed) break;
    }

    if (!placed) {
      bins.push({
        stockLength: sheetLength,
        stockWidth: sheetWidth,
        shelves: [
          {
            y: 0,
            height: h,
            pieces: [{ piece, x: 0, y: 0, w, h }],
            usedWidth: w,
          },
        ],
        usedHeight: h,
      });
    }
  }

  const totalArea = bins.reduce((s, b) => s + b.stockLength * b.stockWidth, 0);
  const usedArea = bins.reduce(
    (s, b) =>
      s +
      b.shelves.reduce(
        (ss, sh) => ss + sh.pieces.reduce((sss, p) => sss + p.w * p.h, 0),
        0,
      ),
    0,
  );

  return {
    billable,
    representativeMaterialZh,
    thickness,
    pieces,
    bins,
    utilization: totalArea > 0 ? usedArea / totalArea : 0,
  };
}
