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

// ---------------------------------------------------------------------------
// 印表機校正（2026-08-20 實機回饋：印出的樣板全長少 2mm，量 100mm 證明尺只有
// 99.5mm——印表機本身有固定的機械縮放誤差，不是列印對話框設定錯，使用者本來
// 就是用「實際大小 100%」印的）。
//
// 校正做在幾何裡，不叫使用者跟列印對話框搏鬥（很多對話框只吃整數 %，各家印
// 表機行為又不一致，不可靠）。核心比例 s＝量到的 / 應該的（例如 99.5/100＝
// 0.995，代表印表機把東西縮成 0.995 倍）。畫在紙面座標 p 的東西，印出來實際
// 是 p×s；要讓印出來等於真實尺寸 f，就必須畫在 p = f/s。詳細幾何推導見
// tile-sheet.ts 的 tilePageGeometry 註解。
// ---------------------------------------------------------------------------

/**
 * 印表機校正測試線的標稱長度 mm。
 *
 * 原本沿用 100mm 證明尺，但 0.5% 的印表機誤差在 100mm 上只差 0.5mm，一般人拿
 * 尺很難量準；改成 250mm 之後同樣的 0.5% 誤差變成 1.25mm，好量很多。橫放 A4
 * 內縮 15mm（TILE_MARGIN_MM）後可用寬度 267mm，250mm 放得下。
 */
export const CALIBRATION_TEST_LINE_MM = 250;

/** 校正比例 s 的合理下限──超出視為量錯或印表機故障，擋下不接受（不能靜默套用離譜的縮放）。 */
export const CALIBRATION_MIN_S = 0.9;
/** 校正比例 s 的合理上限。 */
export const CALIBRATION_MAX_S = 1.1;

/**
 * 250mm 測試線上，跟標稱值差在這個 mm 數以內，就算印表機已經夠準，不值得使用者
 * 折騰去填校正欄位。依據：1mm / 250mm ≈ 0.4%，換算到方凳凳腳 445mm 全長約
 * 1.8mm——已經接近會影響榫孔對位的量級，值得留意；再小的誤差對木工實務沒有
 * 意義。純粹是 UI 的輕量提示用途，不影響實際校正計算本身（使用者填多少就套
 * 用多少，不會被這個門檻吃掉精度）。
 */
export const CALIBRATION_NEGLIGIBLE_MM = 1;

/** 從「250mm 測試線量到的長度」換算成校正比例 s。 */
export function calibrationScale(measuredMm: number): number {
  return measuredMm / CALIBRATION_TEST_LINE_MM;
}

export interface TileSpec {
  /** 欄（0-based，由左到右）。 */
  c: number;
  /** 列（0-based，由上到下）。 */
  r: number;
  /** 該張涵蓋 face 座標的左上角 x（mm，真實世界 mm，不是紙面 mm）。 */
  x: number;
  /** 該張涵蓋 face 座標的左上角 y（mm，真實世界 mm）。 */
  y: number;
  /**
   * 該張涵蓋的寬度（mm，真實世界 mm）＝可用區寬，所有張一致（末張超出 face 的
   * 部分本來就沒內容）。有校正（s≠1）時這是「可用區換算成真實世界的量」
   * （usableFace = usablePaper × s），不是紙張本身的可用區——紙張可用區永遠是
   * TILE_MARGIN_MM 內縮出來的固定值，跟校正無關。
   */
  w: number;
  /** 該張涵蓋的高度（mm，真實世界 mm）＝可用區高。 */
  h: number;
}

export interface TilePlan {
  /** true = A4 橫放（297×210），false = 直放（210×297）。 */
  landscape: boolean;
  cols: number;
  rows: number;
  tiles: TileSpec[];
}

/**
 * s＝校正比例（量到的/應該的，見檔頭說明）。usablePaper 是紙張可用區（固定，
 * 跟校正無關）；usableFace 是這張實際能涵蓋多少「真實世界 mm」的內容——印表機
 * 縮水（s<1）時，同樣的紙張可用區能塞進去的真實內容變少（usableFace =
 * usablePaper × s），所以校正後同一個零件可能被切成更多張，這是正確行為，不是
 * bug（縮水的印表機本來就該多切一張換取尺寸準確）。
 *
 * stepW/stepH（真實世界 mm 的步進量）＝usableFace－重疊量，重疊量本身就是「要
 * 在真實世界重疊多少 mm」，不需要跟著 s 換算（TILE_OVERLAP_MM 定義的是使用者
 * 拿到手上兩張紙、貼在一起時實際要重複的內容寬度，這件事跟印表機縮放無關）。
 */
function planFor(faceW: number, faceH: number, landscape: boolean, s: number): TilePlan {
  const pageW = landscape ? A4.w : A4.h;
  const pageH = landscape ? A4.h : A4.w;
  const usablePaperW = pageW - TILE_MARGIN_MM * 2;
  const usablePaperH = pageH - TILE_MARGIN_MM * 2;
  const usableFaceW = usablePaperW * s;
  const usableFaceH = usablePaperH * s;
  const stepW = usableFaceW - TILE_OVERLAP_MM;
  const stepH = usableFaceH - TILE_OVERLAP_MM;
  const cols = faceW <= usableFaceW ? 1 : Math.ceil((faceW - TILE_OVERLAP_MM) / stepW);
  const rows = faceH <= usableFaceH ? 1 : Math.ceil((faceH - TILE_OVERLAP_MM) / stepH);

  const tiles: TileSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({ c, r, x: c * stepW, y: r * stepH, w: usableFaceW, h: usableFaceH });
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
 *
 * @param s 印表機校正比例，預設 1（不校正，跟原本行為完全一樣）。見檔頭說明。
 */
export function planA4Tiles(faceW: number, faceH: number, s: number = 1): TilePlan | null {
  const landscapePlan = planFor(faceW, faceH, true, s);
  const portraitPlan = planFor(faceW, faceH, false, s);
  const plan = portraitPlan.tiles.length < landscapePlan.tiles.length ? portraitPlan : landscapePlan;
  if (plan.tiles.length > MAX_TILES_PER_FACE) return null;
  return plan;
}
