/**
 * 木作天花板骨架算料引擎 — 型別定義
 *
 * 全模組單位:**cm**(UI 與內部一致,避免 mm/cm 轉換錯誤)。
 * 輸出時材料表「總長」用 m 顯示,單支長度用 cm。
 *
 * 名詞對照(見 README §CE 或 docs/drafting-math.md §CE):
 *   邊框角材 (frame)      — 沿四面牆固定的外框
 *   主支角材 (main joist) — 跨房間的主支撐,預設中心距 90.9 cm
 *   副支角材 (sub joist)  — 主支之間的次支撐,預設中心距 36.36 cm
 *   吊筋     (hanger)     — 樓板垂下吊住骨架,長度 = 板高 − 天花板高
 *   矽酸鈣板 (board)      — 封下緣的板材,標準 90×180 cm(3×6 尺)
 */

/** 主支排版基準(沿長邊):決定第一根主支起點、剩餘收邊留哪側 */
export type AlignmentBase = "left" | "center" | "right";

/** 副支排版基準(沿短邊):決定第一根副支起點、剩餘空間留上 / 下 / 兩側 */
export type SubAlignmentBase = "top" | "middle" | "bottom";

/**
 * 吊筋密度策略(Q3 對話結論 → 做成 toggle):
 *   "standard" = 業界標準:主支沿線每 ~hangerSpacingCm 補一支(中段含)
 *   "minimal"  = 圖示版:每根主支只在兩端各一支(中段不補)
 */
export type HangerDensity = "standard" | "minimal";

export interface CeilingInput {
  /** 長邊(cm) */
  longSideCm: number;
  /** 短邊(cm) */
  shortSideCm: number;
  /** 板高 = 樓板到地面(cm) */
  slabHeightCm: number;
  /** 天花板高 = 完成後天花板到地面(cm) */
  ceilingHeightCm: number;

  /** 主支中心距(cm),預設 90.9 = 3 尺 */
  mainSpacingCm: number;
  /** 副支中心距(cm),預設 36.36 = 1.2 尺(對齊矽酸鈣板寬度的均分) */
  subSpacingCm: number;
  /** 主支排版基準(沿長邊) */
  alignmentBase: AlignmentBase;
  /** 副支排版基準(沿短邊),預設 middle 對稱分配剩餘空間 */
  subAlignmentBase: SubAlignmentBase;
  /** 邊框是否兼當第一/最後一根主支(=否時,主支與邊框內側對接,邊框不負重) */
  frameDoublesAsSupport: boolean;

  /** 角材截面寬(cm),預設 3.6 = 1.2 寸 */
  timberWidthCm: number;
  /** 角材截面厚(cm),預設 3.0 = 1 寸 */
  timberThicknessCm: number;

  /** 矽酸鈣板長邊(cm),預設 180 */
  boardLongCm: number;
  /** 矽酸鈣板短邊(cm),預設 90 */
  boardShortCm: number;
  /** 板邊預留接縫(mm),預設 3 mm(業界規範 3-6 mm,9mm 板建議 3 mm) */
  jointGapMm: number;

  /** 吊筋密度策略 */
  hangerDensity: HangerDensity;
  /** 吊筋沿主支方向的中心距(cm),預設 90;僅 hangerDensity="standard" 時使用 */
  hangerSpacingCm: number;
}

/** 由輸入自動算出、唯讀顯示的數字 */
export interface AutoCalc {
  /** 吊筋高度 = 板高 − 天花板高 (cm) */
  hangerHeightCm: number;
  /** 房間面積 = 長 × 短 / 10000 (m²) */
  roomAreaM2: number;
  /** 坪數 = 房間面積 / 3.305 (1 坪 = 3.305 m²) */
  pingShu: number;
  /** 剩餘收邊 = 長邊 − 主支已用 span (cm),依排版基準分配 */
  leftoverCm: number;
  /** 主支「邏輯」根數(含可能與邊框重疊者) */
  mainPositionCount: number;
}

/** 一行材料(角材按支數,板材按張數,邊框按總長) */
export interface BomItem {
  category:
    | "frame"        // 邊框角材
    | "main-joist"   // 主支角材
    | "sub-joist"    // 副支角材
    | "hanger"       // 吊筋
    | "board-full"   // 整張矽酸鈣板
    | "board-cut";   // 裁切矽酸鈣板
  /** 中文顯示名(可帶長度/規格) */
  nameZh: string;
  /** 規格描述,例 "3.6×3.0 cm" 或 "90×180 cm" */
  spec: string;
  /** 單支長度(角材用);邊框類用 totalLengthM 而非此欄 */
  unitLengthCm?: number;
  /** 整批總長(僅邊框 / 吊筋總長類用)(m) */
  totalLengthM?: number;
  /** 數量(支 / 張) */
  count: number;
  /** 備註(計算過程透明化:給師傅核對用) */
  note?: string;
}

export interface CeilingBom {
  input: CeilingInput;
  auto: AutoCalc;
  items: BomItem[];
  /** 計算過程的中間值(給驗證頁顯示公式對照用) */
  trace: {
    /** 主支中心位置陣列(沿長邊方向,單位 cm) */
    mainJoistCentersCm: number[];
    /** 主支實際下料根數(扣除邊框兼支撐時的兩根) */
    mainJoistTimberCount: number;
    /** 主支單支長度(cm) */
    mainJoistLengthCm: number;
    /** 支撐點(含邊框)沿長邊方向位置陣列,排序去重 */
    supportPositionsCm: number[];
    /** 每個 slot 的寬度與副支長度與數量 */
    slots: Array<{
      fromCm: number;
      toCm: number;
      slotWidthCm: number;
      subJoistLengthCm: number;
      subJoistCount: number;
    }>;
    /** 每根主支上的吊筋數量(standard / minimal 模式分別算) */
    hangerPerMainJoist: number;
    /** 矽酸鈣板鋪法的列數(沿短邊)與行數(沿長邊) */
    boardRows: number;
    boardCols: number;
    /** 矽酸鈣板「鋪法說明」for 驗證頁 */
    boardLayoutDescription: string;
    /** 副支 Y 中心位置陣列(相對 innerY0,單位 cm),所有 slot 共用 */
    subJoistYOffsetsCm: number[];
    /** 副支剩餘空間(短邊內側 - (N-1)*spacing) */
    subLeftoverCm: number;
  };
}

/** 給 UI 用的預設值 */
export const DEFAULT_CEILING_INPUT: CeilingInput = {
  longSideCm: 500,
  shortSideCm: 320,
  slabHeightCm: 280,
  ceilingHeightCm: 260,

  mainSpacingCm: 90,    // 公制裝潢實務(老派台尺 90.9 在 form 可改回)
  subSpacingCm: 36,     // 公制裝潢實務(老派台尺 1.2 尺 = 36.36 可改回)
  alignmentBase: "center",
  subAlignmentBase: "middle",
  frameDoublesAsSupport: false,

  timberWidthCm: 3.6,
  timberThicknessCm: 3.0,

  boardLongCm: 180,
  boardShortCm: 90,
  jointGapMm: 3,        // 板邊接縫 3 mm(業界標準 3-6,9mm 板取 3)

  hangerDensity: "standard",
  hangerSpacingCm: 90,
};
