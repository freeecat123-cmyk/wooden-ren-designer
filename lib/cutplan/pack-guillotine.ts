import type { CutPiece, SheetBin, StockGroup, StockItem } from "./types";
import type { PoolItem } from "./pack";

/**
 * Guillotine packer (MaxRects 簡化版)。
 *
 * 核心差別 vs shelf packer：shelf 把板子切成一條條水平長條，每條高度被該條內
 * 最高的零件綁死——結果就是「這條只能放 40mm 的零件，右邊 700mm 空間用不到」
 * 這種死洞。
 *
 * Guillotine 每放一塊零件，就把當時的可用矩形切成兩個子矩形（L 型剩餘），
 * 以後放零件時可以填到任一個子矩形。小零件能塞進大零件旁的「肚子」。
 *
 * 放零件用 BSSF（Best Short Side Fit）：挑剩餘短邊最小的矩形，把廢料
 * 集中成長條，方便之後填小件或當大塊廢料保留。
 */
export function packGroupGuillotine(
  kind: StockItem["kind"],
  material: StockGroup["material"],
  thickness: number,
  pieces: CutPiece[],
  sharedPool: PoolItem[],
  kerf: number,
  minWasteMm: number,
  allowRotateForSolid: boolean,
): StockGroup {
  void minWasteMm;
  const pool = sharedPool.filter((s) => {
    if (s.kind !== kind) return false;
    if (kind === "solid" && s.material !== material) return false;
    return true;
  });

  type Item = {
    piece: CutPiece;
    w: number;
    h: number;
    canRotate: boolean;
  };
  const prepped: Item[] = pieces.map((piece) => {
    const maxSide = Math.max(piece.length, piece.width);
    const minSide = Math.min(piece.length, piece.width);
    // 實木絕不旋轉——纖維方向鎖死；板材看單件 allowRotate 旗標
    void allowRotateForSolid;
    const canRotate = kind === "solid" ? false : piece.allowRotate === true;
    return { piece, w: maxSide, h: minSide, canRotate };
  });
  // 面積降序——先放大的讓後續切割切出有用的空間
  prepped.sort((a, b) => b.w * b.h - a.w * a.h);

  type FreeRect = { x: number; y: number; w: number; h: number };
  const bins: SheetBin[] = [];
  const freeRectsPerBin: FreeRect[][] = [];
  const unplaced: CutPiece[] = [];

  function pruneContained(list: FreeRect[]) {
    // 移除被其他 free rect 包含的矩形（MaxRects 常見清理）
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      let contained = false;
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const b = list[j];
        if (
          a.x >= b.x &&
          a.y >= b.y &&
          a.x + a.w <= b.x + b.w &&
          a.y + a.h <= b.y + b.h
        ) {
          contained = true;
          break;
        }
      }
      if (contained) list.splice(i, 1);
    }
  }

  function splitRect(
    rect: FreeRect,
    pieceW: number,
    pieceH: number,
    list: FreeRect[],
  ) {
    const remW = rect.w - pieceW - kerf;
    const remH = rect.h - pieceH - kerf;
    // SAS（Shorter Axis Split）：沿短軸切，保留另一邊為完整長條
    const splitHoriz = remW <= remH;
    if (splitHoriz) {
      // 橫切（零件下方保留完整寬的長條，零件右側只到零件高）
      if (remH > 0 && rect.w > 0)
        list.push({
          x: rect.x,
          y: rect.y + pieceH + kerf,
          w: rect.w,
          h: remH,
        });
      if (remW > 0 && pieceH > 0)
        list.push({
          x: rect.x + pieceW + kerf,
          y: rect.y,
          w: remW,
          h: pieceH,
        });
    } else {
      // 縱切（零件右側保留完整高的長條，零件下方只到零件寬）
      if (remW > 0 && rect.h > 0)
        list.push({
          x: rect.x + pieceW + kerf,
          y: rect.y,
          w: remW,
          h: rect.h,
        });
      if (remH > 0 && pieceW > 0)
        list.push({
          x: rect.x,
          y: rect.y + pieceH + kerf,
          w: pieceW,
          h: remH,
        });
    }
  }

  function openNewBin(): number | null {
    for (const s of pool) {
      if (s.remaining <= 0) continue;
      s.remaining -= 1;
      bins.push({
        stockLength: s.length,
        stockWidth: s.width,
        shelves: [],
        usedHeight: 0,
        guillotine: true,
      });
      freeRectsPerBin.push([{ x: 0, y: 0, w: s.length, h: s.width }]);
      return bins.length - 1;
    }
    return null;
  }

  type Best = {
    binIdx: number;
    rectIdx: number;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
    score: number;
  };

  function findBestFit(item: Item): Best | null {
    let best: Best | null = null;
    const attempts = item.canRotate
      ? [
          { w: item.w, h: item.h, rotated: false },
          { w: item.h, h: item.w, rotated: true },
        ]
      : [{ w: item.w, h: item.h, rotated: false }];
    for (let b = 0; b < bins.length; b++) {
      const rects = freeRectsPerBin[b];
      for (let r = 0; r < rects.length; r++) {
        const rect = rects[r];
        for (const att of attempts) {
          if (att.w <= rect.w && att.h <= rect.h) {
            const leftover = Math.min(rect.w - att.w, rect.h - att.h);
            if (!best || leftover < best.score) {
              best = {
                binIdx: b,
                rectIdx: r,
                x: rect.x,
                y: rect.y,
                w: att.w,
                h: att.h,
                rotated: att.rotated,
                score: leftover,
              };
            }
          }
        }
      }
    }
    return best;
  }

  for (const item of prepped) {
    let best = findBestFit(item);
    if (!best) {
      // 開新板
      const idx = openNewBin();
      if (idx === null) {
        unplaced.push(item.piece);
        continue;
      }
      best = findBestFit(item);
      if (!best) {
        unplaced.push(item.piece);
        continue;
      }
    }

    const bin = bins[best.binIdx];
    const rects = freeRectsPerBin[best.binIdx];
    const rect = rects[best.rectIdx];

    // 每塊零件一個獨立 shelf（渲染層用；guillotine 標記會抑制 shelf 間 kerf 畫線）
    bin.shelves.push({
      y: best.y,
      height: best.h,
      pieces: [
        {
          piece: item.piece,
          x: best.x,
          y: best.y,
          w: best.w,
          h: best.h,
          rotated: best.rotated,
        },
      ],
      usedWidth: best.x + best.w,
    });
    if (best.y + best.h > bin.usedHeight) bin.usedHeight = best.y + best.h;

    rects.splice(best.rectIdx, 1);
    splitRect(rect, best.w, best.h, rects);
    pruneContained(rects);
  }

  // 切料順序：依位置 top-to-bottom、left-to-right
  for (const bin of bins) {
    const flat: Array<SheetBin["shelves"][number]["pieces"][number]> = [];
    for (const shelf of bin.shelves) for (const p of shelf.pieces) flat.push(p);
    flat.sort((a, b) => a.y - b.y || a.x - b.x);
    flat.forEach((p, i) => (p.order = i + 1));
  }

  // 利用率：guillotine 不扣零碎邊料（不像 shelf 能判斷「shelf 尾巴」）
  let usedArea = 0;
  let denom = 0;
  for (const bin of bins) {
    let u = 0;
    for (const shelf of bin.shelves)
      for (const p of shelf.pieces) u += p.w * p.h;
    usedArea += u;
    denom += bin.stockLength * bin.stockWidth;
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
