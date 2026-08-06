/**
 * 套料排版（2D 刀線式 / guillotine）——把一堆「已攤平的零件輪廓」排進**實際板材尺寸**。
 *
 * ⭐為什麼不是原本那套 shelf packing：
 *  舊版把板子切成一條條水平長條，每條的高度被該條最高的零件綁死 → 「這條只放得下
 *  40mm 的牙條，右邊 700mm 的空間就永遠用不到」。而且它沒有板長上限（高度無限往下長），
 *  等於假設有一張無限長的板；也沒有鋸路／刀徑間距的概念，更沒有把不同料厚分開
 *  （18mm 夾板和 45mm 桌腳排在同一張板上，那張圖根本切不出來）。
 *
 * 這裡用的刀線式：每放一塊零件就把當時的可用矩形切成兩個子矩形（L 型剩餘），
 * 之後的小零件可以填進大零件旁邊的「肚子」。挑位置用 BSSF（Best Short Side Fit）＝
 * 選剩餘短邊最小的矩形，把廢料集中成長條，方便之後填小件。
 *
 * 🔗 演算法與 `lib/cutplan/pack-guillotine.ts`（裁切計算器）是同一套，但**刻意分開實作**：
 *   裁切計算器處理的是抽象木料，`length` 定義成沿纖維方向，所以它把每塊零件正規化成
 *   「長邊橫放」；這裡處理的是已經投影完成的 2D 輪廓，**方向是圖決定的、不能亂轉**
 *   （轉了圖就跟輪廓對不上）。硬套那支會讓所有直立零件被偷偷轉成橫的。
 *   兩邊都改演算法時記得一起看。
 */

export interface Pt {
  x: number;
  y: number;
}

/** 一片要排進板子的零件（輪廓已平移到 (0,0)、Y 向下＝SVG 慣例）。 */
export interface NestPiece {
  /** 畫在零件中央的編號 */
  label: string;
  outline: Pt[];
  /** 這一片上要一起加工的圓孔（榫孔等） */
  circles?: Array<{ cx: number; cy: number; r: number; title?: string }>;
  /** 這一片上要一起加工的封閉內框（方榫孔 / 公榫輪廓等） */
  innerPaths?: Array<{ pts: Pt[]; title?: string }>;
  w: number;
  h: number;
  /** 分組鍵：**不同料厚／材質不能排在同一張板**（切不出來） */
  stockKey: string;
  /** 分組顯示名，例：「18mm 夾板」 */
  stockLabel: string;
  /** 允許轉 90°。板材可以；實木不行——轉了木紋就橫過來，強度與伸縮全變 */
  allowRotate: boolean;
}

export interface NestSheetConfig {
  /** 板長（mm）。預設 2440＝4×8 呎夾板長邊 */
  sheetLengthMm: number;
  /** 板寬（mm）。預設 1220 */
  sheetWidthMm: number;
  /**
   * 零件之間、以及零件與板邊之間要留的間距（mm）＝**刀縫**。
   * CNC 要放得下刀具：6mm 銑刀留 8mm 剛好；雷切可以縮到 1~2mm；圓鋸台鋸路約 3mm。
   */
  kerfMm: number;
}

export const DEFAULT_SHEET: NestSheetConfig = {
  sheetLengthMm: 2440,
  sheetWidthMm: 1220,
  kerfMm: 8,
};

export interface PlacedPiece {
  piece: NestPiece;
  x: number;
  y: number;
  /** 實際佔位尺寸（已含旋轉） */
  w: number;
  h: number;
  rotated: boolean;
}

export interface NestedSheet {
  stockKey: string;
  stockLabel: string;
  /** 同材別內第幾張（1-based）／共幾張 */
  index: number;
  total: number;
  /**
   * 這張圖的實際尺寸（mm）＝**裁到真正用到的範圍**，不是整張板。
   * ⭐為什麼要裁：一張 4×8 板上只躺了四支凳腳，輸出一張 2440×1220 的圖等於叫人
   *  對著一片空白找零件。裁掉之後這張圖就是「你要準備的那塊料多大」，直接量、直接上機。
   *  零件座標不變（排料一律從左上角開始），所以裁不裁都對得上板子的角落。
   */
  lengthMm: number;
  widthMm: number;
  /** 原本要排進去的板材尺寸（裁切前）。 */
  stockLengthMm: number;
  stockWidthMm: number;
  /** 零件外框面積 ÷ 這張圖的面積（0..1）＝排得密不密，跟板子多大無關。 */
  utilization: number;
  /** 這張板有沒有為了塞下超大零件而放大（放大過就不是標準板了，要提醒） */
  enlarged: boolean;
  pieces: PlacedPiece[];
}

/**
 * 依材別分組 → 各自排進板材。回傳每一張板的排版結果。
 *
 * 板子放不下的零件不會被丟掉：那一組的板會自動放大到裝得下最大的那一片，並標記
 * `enlarged`。寧可產出一張「非標準尺寸」的圖，也不要靜靜少掉一個零件。
 */
export function nestPieces(
  pieces: readonly NestPiece[],
  cfg: NestSheetConfig = DEFAULT_SHEET,
): NestedSheet[] {
  const kerf = Math.max(0, cfg.kerfMm);
  const byStock = new Map<string, NestPiece[]>();
  for (const p of pieces) {
    const list = byStock.get(p.stockKey);
    if (list) list.push(p);
    else byStock.set(p.stockKey, [p]);
  }

  const out: NestedSheet[] = [];
  for (const [stockKey, list] of byStock) {
    // 板一定要裝得下最大的一片（含邊距），否則零件會排不進去。
    // 零件可轉時只要「長邊 ≤ 板長、短邊 ≤ 板寬」；不可轉時長寬各自要塞得下。
    let needL = cfg.sheetLengthMm;
    let needW = cfg.sheetWidthMm;
    for (const p of list) {
      const [a, b] = p.allowRotate
        ? [Math.max(p.w, p.h), Math.min(p.w, p.h)]
        : [p.w, p.h];
      needL = Math.max(needL, a + kerf * 2);
      needW = Math.max(needW, b + kerf * 2);
    }
    const enlarged = needL > cfg.sheetLengthMm || needW > cfg.sheetWidthMm;
    // 實際排料只用扣掉四周邊距的區域，畫的時候再整體平移回來
    const bins = packGuillotine(list, needL - kerf * 2, needW - kerf * 2, kerf);
    bins.forEach((bin, i) => {
      const placed = bin.map((pl) => ({ ...pl, x: pl.x + kerf, y: pl.y + kerf }));
      let used = 0;
      let right = 0;
      let bottom = 0;
      for (const pl of placed) {
        used += pl.w * pl.h;
        right = Math.max(right, pl.x + pl.w);
        bottom = Math.max(bottom, pl.y + pl.h);
      }
      // 裁到用到的範圍（四周仍保留一個刀縫的邊）；沒排滿的板才會真的變小
      const cutL = Math.min(needL, right + kerf);
      const cutW = Math.min(needW, bottom + kerf);
      out.push({
        stockKey,
        stockLabel: list[0].stockLabel,
        index: i + 1,
        total: bins.length,
        lengthMm: cutL,
        widthMm: cutW,
        stockLengthMm: needL,
        stockWidthMm: needW,
        utilization: cutL * cutW > 0 ? Math.min(1, used / (cutL * cutW)) : 0,
        enlarged,
        pieces: placed,
      });
    });
  }
  return out;
}

// ---- 刀線式 packer ----

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 把零件排進 usableL × usableW 的區域，需要幾張就開幾張。回傳每張板的擺放結果。 */
function packGuillotine(
  items: readonly NestPiece[],
  usableL: number,
  usableW: number,
  kerf: number,
): PlacedPiece[][] {
  // 面積降序：先放大的，切出來的剩餘空間才有用
  const order = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
  const bins: PlacedPiece[][] = [];
  const freeRects: FreeRect[][] = [];

  for (const piece of order) {
    let best = findBestFit(piece);
    if (!best) {
      bins.push([]);
      freeRects.push([{ x: 0, y: 0, w: usableL, h: usableW }]);
      best = findBestFit(piece);
      if (!best) {
        // 理論上不會發生（nestPieces 已把板放大到裝得下），保險起見丟回新板左上角，
        // 讓它至少被畫出來而不是無聲消失。
        bins[bins.length - 1].push({ piece, x: 0, y: 0, w: piece.w, h: piece.h, rotated: false });
        continue;
      }
    }
    const rects = freeRects[best.bin];
    const rect = rects[best.rect];
    bins[best.bin].push({
      piece,
      x: best.x,
      y: best.y,
      w: best.w,
      h: best.h,
      rotated: best.rotated,
    });
    rects.splice(best.rect, 1);
    splitRect(rect, best.w, best.h, kerf, rects);
    pruneContained(rects);
  }
  return bins;

  function findBestFit(piece: NestPiece) {
    // 不可轉的零件只有一種擺法——這裡跟裁切計算器最大的差別：那邊會把零件正規化成
    // 「長邊橫放」，圖形套料不能這樣做，轉了就跟輪廓對不上。
    const attempts = piece.allowRotate
      ? [
          { w: piece.w, h: piece.h, rotated: false },
          { w: piece.h, h: piece.w, rotated: true },
        ]
      : [{ w: piece.w, h: piece.h, rotated: false }];
    let best: {
      bin: number; rect: number; x: number; y: number;
      w: number; h: number; rotated: boolean; score: number;
    } | null = null;
    for (let b = 0; b < bins.length; b++) {
      const rects = freeRects[b];
      for (let r = 0; r < rects.length; r++) {
        const rect = rects[r];
        for (const att of attempts) {
          if (att.w > rect.w || att.h > rect.h) continue;
          // BSSF：剩餘短邊最小者勝 → 廢料集中成長條而不是四散的小碎塊
          const score = Math.min(rect.w - att.w, rect.h - att.h);
          if (!best || score < best.score) {
            best = { bin: b, rect: r, x: rect.x, y: rect.y, w: att.w, h: att.h, rotated: att.rotated, score };
          }
        }
      }
    }
    return best;
  }
}

/**
 * SAS（Shorter Axis Split）：沿短軸切，把另一邊留成完整長條。
 * 留成長條的那一半比較容易再塞下一個零件，切成兩個方塊反而兩邊都放不下。
 */
function splitRect(rect: FreeRect, w: number, h: number, kerf: number, list: FreeRect[]): void {
  const remW = rect.w - w - kerf;
  const remH = rect.h - h - kerf;
  if (remW <= remH) {
    if (remH > 0) list.push({ x: rect.x, y: rect.y + h + kerf, w: rect.w, h: remH });
    if (remW > 0 && h > 0) list.push({ x: rect.x + w + kerf, y: rect.y, w: remW, h });
  } else {
    if (remW > 0) list.push({ x: rect.x + w + kerf, y: rect.y, w: remW, h: rect.h });
    if (remH > 0 && w > 0) list.push({ x: rect.x, y: rect.y + h + kerf, w, h: remH });
  }
}

/** 移除被其他剩餘矩形完全包含的矩形（不清掉的話 free list 會越滾越大且重複命中）。 */
function pruneContained(list: FreeRect[]): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const b = list[j];
      if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
        list.splice(i, 1);
        break;
      }
    }
  }
}
