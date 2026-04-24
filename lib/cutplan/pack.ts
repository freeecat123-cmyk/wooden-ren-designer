import type { CutPiece, SheetBin, StockGroup, StockItem } from "./types";

/** 可變 pool 項目：remaining 會跨 group 共享消耗 */
export interface PoolItem {
  kind: StockItem["kind"];
  material?: StockGroup["material"];
  length: number;
  width: number;
  remaining: number;
}

/** 從庫存產生共享 pool（不綁厚度——一筆庫存可同時供應多種厚度零件） */
export function buildSharedPool(stocks: StockItem[]): PoolItem[] {
  return stocks
    .map<PoolItem>((s) => ({
      kind: s.kind,
      material: s.kind === "solid" ? s.material : undefined,
      length: s.length,
      width: s.width,
      remaining: s.count === null || s.count <= 0 ? Infinity : s.count,
    }))
    .sort((a, b) => a.length * a.width - b.length * b.width);
}

/**
 * 統一 2D shelf 排料器：實木 + 板材走同一套邏輯。
 *
 * - 板材（plywood / mdf）：依 allowRotate 嘗試旋轉
 * - 實木（solid）：不旋轉（纖維方向敏感）
 *
 * 同 kind + (material if solid) + thickness 為一組。但 sharedPool 不依厚度篩，
 * 因此一筆實際庫存可同時供應不同厚度的零件（餘量在多個 group 之間共享消耗）。
 */
export function packGroup(
  kind: StockItem["kind"],
  material: StockGroup["material"],
  thickness: number,
  pieces: CutPiece[],
  sharedPool: PoolItem[],
  kerf: number,
  minWasteMm: number,
  allowRotateForSolid: boolean,
): StockGroup {
  void thickness;
  const pool = sharedPool.filter((s) => {
    if (s.kind !== kind) return false;
    if (kind === "solid" && s.material !== material) return false;
    return true;
  });

  // 零件定向：長邊沿板長、短邊沿板寬
  const prepped = pieces.map((piece) => {
    const maxSide = Math.max(piece.length, piece.width);
    const minSide = Math.min(piece.length, piece.width);
    // 旋轉規則：solid 預設不轉（除非 allowRotateForSolid），板材看 piece.allowRotate
    const canRotate =
      kind === "solid" ? allowRotateForSolid : piece.allowRotate === true;
    return { piece, w: maxSide, h: minSide, canRotate };
  });
  prepped.sort((a, b) => b.h - a.h || b.w - a.w);

  const bins: SheetBin[] = [];
  const unplaced: CutPiece[] = [];

  function tryFit(
    item: (typeof prepped)[number],
    shelf: SheetBin["shelves"][number],
    boardLen: number,
  ): { x: number; w: number; h: number; rotated: boolean } | null {
    const attempts = item.canRotate
      ? [
          { w: item.w, h: item.h, rotated: false },
          { w: item.h, h: item.w, rotated: true },
        ]
      : [{ w: item.w, h: item.h, rotated: false }];
    for (const att of attempts) {
      const addKerf = shelf.pieces.length > 0 ? kerf : 0;
      if (shelf.usedWidth + addKerf + att.w <= boardLen && att.h <= shelf.height) {
        return { x: shelf.usedWidth + addKerf, ...att };
      }
    }
    return null;
  }

  function tryOpenShelf(
    item: (typeof prepped)[number],
    bin: SheetBin,
  ): { w: number; h: number; rotated: boolean } | null {
    const attempts = item.canRotate
      ? [
          { w: item.w, h: item.h, rotated: false },
          { w: item.h, h: item.w, rotated: true },
        ]
      : [{ w: item.w, h: item.h, rotated: false }];
    for (const att of attempts) {
      const addKerf = bin.shelves.length > 0 ? kerf : 0;
      if (
        bin.usedHeight + addKerf + att.h <= bin.stockWidth &&
        att.w <= bin.stockLength
      ) {
        return att;
      }
    }
    return null;
  }

  function takeBoard(
    item: (typeof prepped)[number],
  ): { length: number; width: number; rotated: boolean } | null {
    const attempts = item.canRotate
      ? [
          { w: item.w, h: item.h, rotated: false },
          { w: item.h, h: item.w, rotated: true },
        ]
      : [{ w: item.w, h: item.h, rotated: false }];
    for (const s of pool) {
      if (s.remaining <= 0) continue;
      for (const att of attempts) {
        if (s.length >= att.w && s.width >= att.h) {
          s.remaining -= 1;
          return { length: s.length, width: s.width, rotated: att.rotated };
        }
      }
    }
    return null;
  }

  for (const item of prepped) {
    let placed = false;
    for (const bin of bins) {
      for (const shelf of bin.shelves) {
        const fit = tryFit(item, shelf, bin.stockLength);
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
          placed = true;
          break;
        }
      }
      if (placed) break;
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
        placed = true;
        break;
      }
    }

    if (!placed) {
      const brd = takeBoard(item);
      if (!brd) {
        unplaced.push(item.piece);
        continue;
      }
      const w = brd.rotated ? item.h : item.w;
      const h = brd.rotated ? item.w : item.h;
      bins.push({
        stockLength: brd.length,
        stockWidth: brd.width,
        shelves: [
          {
            y: 0,
            height: h,
            pieces: [
              {
                piece: item.piece,
                x: 0,
                y: 0,
                w,
                h,
                rotated: brd.rotated,
              },
            ],
            usedWidth: w,
          },
        ],
        usedHeight: h,
      });
    }
  }

  // 利用率：零碎剩料 < minWasteMm 不計入分母
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
    kind,
    material,
    thickness,
    pieces,
    bins,
    utilization: denom > 0 ? Math.min(1, usedArea / denom) : 0,
    unplaced,
  };
}
