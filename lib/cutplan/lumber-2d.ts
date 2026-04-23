import type { CutPiece, LumberInvGroup, LumberStock, SheetBin } from "./types";

/**
 * 實木 2D 排料（多寬度庫存模式）：同材質 × 同厚度的零件 ↔ 實體板才清單。
 *
 * 和 packSheet 很像，差別在：
 * - 板才不是無限同規格，而是一條 inventory 清單（每筆自有 L × W × count）
 * - 零件不依 allowRotate——實木木紋方向敏感，預設不旋轉
 * - 開新板時挑「裝得下零件 + 還有庫存 + 尺寸最小」的那筆
 */
export function packLumber2D(
  material: CutPiece["material"],
  thickness: number,
  pieces: CutPiece[],
  stocks: LumberStock[],
  kerf: number,
  minWasteMm: number,
): LumberInvGroup {
  // 把 stocks 依面積降冪（先把大的消耗？不，先消耗小的避免大板被浪費）
  // 實務：由小到大挑，第一個裝得下就用。這樣大板留給大件。
  const stockPool = stocks
    .filter((s) => s.thickness === thickness && s.material === material)
    .map((s) => ({
      length: s.length,
      width: s.width,
      remaining: s.count === null || s.count <= 0 ? Infinity : s.count,
    }))
    .sort((a, b) => a.length * a.width - b.length * b.width);

  // 零件定向：長邊沿板長、短邊沿板寬（不轉）
  const prepped = pieces.map((piece) => {
    const w = Math.max(piece.length, piece.width);
    const h = Math.min(piece.length, piece.width);
    return { piece, w, h };
  });
  prepped.sort((a, b) => b.h - a.h || b.w - a.w);

  const bins: SheetBin[] = [];
  const unplaced: CutPiece[] = [];

  function tryFitShelf(
    item: (typeof prepped)[number],
    shelf: SheetBin["shelves"][number],
    boardLen: number,
  ): { x: number } | null {
    const addKerf = shelf.pieces.length > 0 ? kerf : 0;
    if (shelf.usedWidth + addKerf + item.w <= boardLen && item.h <= shelf.height) {
      return { x: shelf.usedWidth + addKerf };
    }
    return null;
  }

  function tryOpenShelf(
    item: (typeof prepped)[number],
    bin: SheetBin,
  ): boolean {
    const addKerf = bin.shelves.length > 0 ? kerf : 0;
    return (
      bin.usedHeight + addKerf + item.h <= bin.stockWidth &&
      item.w <= bin.stockLength
    );
  }

  /** 找第一個還有庫存、裝得下零件的原料並消耗一筆 */
  function takeNewBoard(item: (typeof prepped)[number]): {
    length: number;
    width: number;
  } | null {
    for (const s of stockPool) {
      if (s.remaining <= 0) continue;
      if (s.length < item.w || s.width < item.h) continue;
      s.remaining -= 1;
      return { length: s.length, width: s.width };
    }
    return null;
  }

  for (const item of prepped) {
    let placed = false;
    for (const bin of bins) {
      for (const shelf of bin.shelves) {
        const fit = tryFitShelf(item, shelf, bin.stockLength);
        if (fit) {
          shelf.pieces.push({
            piece: item.piece,
            x: fit.x,
            y: shelf.y,
            w: item.w,
            h: item.h,
            rotated: false,
          });
          shelf.usedWidth = fit.x + item.w;
          placed = true;
          break;
        }
      }
      if (placed) break;
      if (tryOpenShelf(item, bin)) {
        const addKerf = bin.shelves.length > 0 ? kerf : 0;
        const y = bin.usedHeight + addKerf;
        bin.shelves.push({
          y,
          height: item.h,
          pieces: [
            {
              piece: item.piece,
              x: 0,
              y,
              w: item.w,
              h: item.h,
              rotated: false,
            },
          ],
          usedWidth: item.w,
        });
        bin.usedHeight = y + item.h;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const brd = takeNewBoard(item);
      if (!brd) {
        unplaced.push(item.piece);
        continue;
      }
      bins.push({
        stockLength: brd.length,
        stockWidth: brd.width,
        shelves: [
          {
            y: 0,
            height: item.h,
            pieces: [
              { piece: item.piece, x: 0, y: 0, w: item.w, h: item.h, rotated: false },
            ],
            usedWidth: item.w,
          },
        ],
        usedHeight: item.h,
      });
    }
  }

  // 利用率：零碎 rip / 末端剩料 < minWasteMm 不計入分母
  let usedArea = 0;
  let denom = 0;
  for (const bin of bins) {
    let binUsed = 0;
    let binDenom = bin.stockLength * bin.stockWidth;
    for (const shelf of bin.shelves) {
      binUsed += shelf.pieces.reduce((s, p) => s + p.w * p.h, 0);
      const restW = bin.stockLength - shelf.usedWidth;
      if (restW < minWasteMm) binDenom -= restW * shelf.height;
    }
    const restH = bin.stockWidth - bin.usedHeight;
    if (restH < minWasteMm) binDenom -= bin.stockLength * restH;
    usedArea += binUsed;
    denom += binDenom;
  }

  return {
    material,
    thickness,
    pieces,
    bins,
    utilization: denom > 0 ? Math.min(1, usedArea / denom) : 0,
    unplaced,
  };
}
