// A4 拼接規劃：把超過一張 A4 的加工面切成多張 A4，橫放直放各算一次取張數少的。
// 純函式、不碰 SVG——渲染邏輯在 tile-sheet.ts。
import { PAPERS } from "./paper";

const A4 = PAPERS.find((p) => p.id === "A4")!;

/** 超過這個張數就不出樣板，退回既有的比例零件圖路徑（brief 決策 1）。 */
export const MAX_TILES_PER_FACE = 6;

/** 相鄰張重疊量 mm（brief 決策 3）。 */
export const TILE_OVERLAP_MM = 10;

/**
 * A4 拼接專用的每邊留白 mm——刻意跟 printshop 單張樣板的 SHEET_MARGIN_MM（5mm）
 * 分開設一個常數，不共用。
 *
 * 家用印表機的不可列印區噴墨常見下緣 13~15mm、雷射 4~6mm，5mm 留白會讓裁切線、
 * 對位十字、方向箭頭直接被印表機吃掉——使用者連要對齊的那條線都看不到，整組
 * 拼接失敗還不知道問題出在哪。15mm 留白吃掉的張數代價幾乎是零（實測：方凳
 * 14 張、餐椅 29 張不變，書桌只多 1 張 33→34），換來的是「印得出來」這個
 * 前提，不能為了省一點紙把它調回去。
 */
export const TILE_MARGIN_MM = 15;

export interface TileSpec {
  /** 欄（0-based，由左到右）。 */
  c: number;
  /** 列（0-based，由上到下）。 */
  r: number;
  /** 該張涵蓋 face 座標的左上角 x（mm）。 */
  x: number;
  /** 該張涵蓋 face 座標的左上角 y（mm）。 */
  y: number;
  /** 該張涵蓋的寬度（mm）＝可用區寬，所有張一致（末張超出 face 的部分本來就沒內容）。 */
  w: number;
  /** 該張涵蓋的高度（mm）＝可用區高。 */
  h: number;
}

export interface TilePlan {
  /** true = A4 橫放（297×210），false = 直放（210×297）。 */
  landscape: boolean;
  cols: number;
  rows: number;
  tiles: TileSpec[];
}

function planFor(faceW: number, faceH: number, landscape: boolean): TilePlan {
  const pageW = landscape ? A4.w : A4.h;
  const pageH = landscape ? A4.h : A4.w;
  const usableW = pageW - TILE_MARGIN_MM * 2;
  const usableH = pageH - TILE_MARGIN_MM * 2;
  const stepW = usableW - TILE_OVERLAP_MM;
  const stepH = usableH - TILE_OVERLAP_MM;
  const cols = faceW <= usableW ? 1 : Math.ceil((faceW - TILE_OVERLAP_MM) / stepW);
  const rows = faceH <= usableH ? 1 : Math.ceil((faceH - TILE_OVERLAP_MM) / stepH);

  const tiles: TileSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({ c, r, x: c * stepW, y: r * stepH, w: usableW, h: usableH });
    }
  }
  return { landscape, cols, rows, tiles };
}

/**
 * 規劃把 faceW×faceH 的加工面切成多張 A4 的方式。橫放直放各算一次，取張數少的
 * （平手取橫放，brief §幾何）。超過 MAX_TILES_PER_FACE 張 → null（退回零件圖，
 * 不可靜默消失——呼叫端要把這個 null 當「太大」處理，跟 fit.ts 的 placeOnLadder
 * 回 null 同一套語意）。
 *
 * 拼接模式一律不旋轉（brief 決策 2：斜擺 + 拼接會讓對齊變成惡夢）。
 */
export function planA4Tiles(faceW: number, faceH: number): TilePlan | null {
  const landscapePlan = planFor(faceW, faceH, true);
  const portraitPlan = planFor(faceW, faceH, false);
  const plan = portraitPlan.tiles.length < landscapePlan.tiles.length ? portraitPlan : landscapePlan;
  if (plan.tiles.length > MAX_TILES_PER_FACE) return null;
  return plan;
}
