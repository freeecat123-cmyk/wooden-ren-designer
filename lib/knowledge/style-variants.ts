/**
 * 風格 × 家具 變體池（structural + size pools）
 *
 * 重複按同一風格鈕 → variantSeed +1 → 用 deterministic hash 從池子抽一組
 * 結構選擇 + ratio 範圍內抽數值。Infinite variation，不重複也不固定列舉。
 *
 * 設計原則：
 *   - 結構選擇從風格容許的池子抽（backStyle / stretcherStyle / withArmrest）
 *   - 數值 ratio 範圍 (pack 值 × [lo, hi])，保留風格識別
 *   - 整體尺寸 length/width ±10%、height ±3%（座高人因不能亂動）
 *   - 沒列在 STYLE_VARIANT_POOLS 的 (style, category) 走 DEFAULT_POOL，仍有
 *     輕度變化
 */
export interface StyleVariantPool {
  // 結構選擇池
  backStyle?: string[];
  stretcherStyle?: string[];
  legShape?: string[];
  withArmrestProbability?: number; // 0-1
  /** legPenetratingTenon = true 機率（明榫裝飾，符合風格才高） */
  legPenetratingTenonProbability?: number;
  // 計數型範圍 [min, max]（含 max）
  backSlatsRange?: [number, number];
  ladderRungsRange?: [number, number];
  // 數值範圍（直接抽絕對值）
  splayAngleRange?: [number, number];
  curvedSplatBendMmRange?: [number, number];
  backRakeRange?: [number, number];
  apronOffsetRange?: [number, number];
  legInsetRange?: [number, number];
  backInsetFromRearMmRange?: [number, number];
  backInsetFromEndMmRange?: [number, number];
  seatCornerRRange?: [number, number];
  // 錯開（stagger）— 牙條前後對下移、橫撐左右對上移，變體強烈視覺差
  apronStaggerMmRange?: [number, number];
  lowerStretcherStaggerMmRange?: [number, number];
  // 椅背 / 橫撐高度
  backTopRailHeightRange?: [number, number];
  lowerStretcherHeightRange?: [number, number]; // 離地高（mm）
  // 數值 ratio（pack 值 × [lo, hi]）
  legSizeRatio?: [number, number];
  apronWidthRatio?: [number, number];
  seatThicknessRatio?: [number, number];
  // 整體尺寸 ratio
  lengthRatio?: [number, number];
  widthRatio?: [number, number];
  heightRatio?: [number, number];
}

const DEFAULT_POOL: StyleVariantPool = {
  legSizeRatio: [0.9, 1.12],
  apronWidthRatio: [0.85, 1.15],
  seatThicknessRatio: [0.92, 1.1],
  lengthRatio: [0.9, 1.1],
  widthRatio: [0.9, 1.1],
  heightRatio: [0.97, 1.03],
};

// Canonical 尺寸：每個 category 的「規範尺寸」，變體 ratio 永遠相對這個算，
// **不從 URL current 算**——避免連按變體時 length × 1.05 × 1.05 ... 複利暴衝。
// 數值從 lib/templates/index.ts FURNITURE_CATALOG defaults 抄來（手動同步）。
const CATEGORY_CANONICAL_SIZE: Record<string, { length: number; width: number; height: number }> = {
  "dining-chair": { length: 450, width: 450, height: 850 },
  "bench": { length: 1200, width: 350, height: 450 },
  "dining-table": { length: 1500, width: 850, height: 740 },
  "side-table": { length: 500, width: 500, height: 600 },
  "low-table": { length: 1000, width: 500, height: 400 },
  "desk": { length: 1200, width: 600, height: 750 },
  "tea-table": { length: 1100, width: 550, height: 420 },
  "stool": { length: 350, width: 350, height: 450 },
  "bar-stool": { length: 350, width: 350, height: 750 },
  "round-stool": { length: 360, width: 360, height: 450 },
  "round-tea-table": { length: 800, width: 800, height: 420 },
  "round-table": { length: 1100, width: 1100, height: 740 },
};

export function getCanonicalSize(category?: string): { length: number; width: number; height: number } | null {
  if (!category) return null;
  return CATEGORY_CANONICAL_SIZE[category] ?? null;
}

export const STYLE_VARIANT_POOLS: Record<string, Record<string, StyleVariantPool>> = {
  industrial: {
    "dining-chair": {
      backStyle: ["ladder", "slats"],
      stretcherStyle: ["h-frame", "box", "side-only"],
      backSlatsRange: [3, 5],
      ladderRungsRange: [2, 4],
      withArmrestProbability: 0.25,
      splayAngleRange: [0, 0],
      legSizeRatio: [0.9, 1.15],
      apronWidthRatio: [0.85, 1.2],
      seatThicknessRatio: [0.9, 1.15],
      apronOffsetRange: [0, 12],
      seatCornerRRange: [0, 8],
      legInsetRange: [0, 8],
      apronStaggerMmRange: [0, 25],
      lowerStretcherStaggerMmRange: [0, 20],
      backTopRailHeightRange: [55, 85],
      lowerStretcherHeightRange: [120, 220],
      legPenetratingTenonProbability: 0.6, // 工業風愛裸露榫頭裝飾
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [0, 0],
      legSizeRatio: [0.9, 1.2],
      apronWidthRatio: [0.85, 1.2],
      seatThicknessRatio: [0.9, 1.2],
      legInsetRange: [0, 8],
      apronStaggerMmRange: [0, 25],
      lowerStretcherStaggerMmRange: [0, 20],
      lowerStretcherHeightRange: [80, 200],
      legPenetratingTenonProbability: 0.6,
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.94, 1.06],
    },
  },
  chippendale: {
    "dining-chair": {
      backStyle: ["splat", "ladder"],
      stretcherStyle: ["h-frame", "side-only"],
      ladderRungsRange: [3, 5],
      withArmrestProbability: 0.4,
      splayAngleRange: [3, 7],
      backRakeRange: [4, 12],
      legSizeRatio: [0.9, 1.1],
      apronWidthRatio: [0.85, 1.15],
      legInsetRange: [10, 25],
      seatCornerRRange: [0, 12],
      apronStaggerMmRange: [0, 20],
      lowerStretcherStaggerMmRange: [0, 15],
      backTopRailHeightRange: [50, 75],
      lowerStretcherHeightRange: [140, 220],
      legPenetratingTenonProbability: 0.1, // Chippendale 重精緻、藏榫
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [3, 7],
      legSizeRatio: [0.9, 1.15],
      apronWidthRatio: [0.85, 1.15],
      seatThicknessRatio: [0.9, 1.15],
      legInsetRange: [10, 25],
      apronStaggerMmRange: [0, 18],
      lowerStretcherStaggerMmRange: [0, 15],
      lowerStretcherHeightRange: [100, 200],
      legPenetratingTenonProbability: 0.1,
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.95, 1.05],
    },
  },
  midCentury: {
    "dining-chair": {
      backStyle: ["slats", "curved-splat"],
      stretcherStyle: ["none", "h-frame"],
      backSlatsRange: [3, 6],
      curvedSplatBendMmRange: [15, 35],
      withArmrestProbability: 0.3,
      splayAngleRange: [8, 14], // midCentury 招牌 Danish splay
      backRakeRange: [3, 10],
      legSizeRatio: [0.85, 1.15],
      apronWidthRatio: [0.85, 1.15],
      seatThicknessRatio: [0.92, 1.15],
      legInsetRange: [15, 35],
      backInsetFromRearMmRange: [0, 15],
      backInsetFromEndMmRange: [0, 15],
      seatCornerRRange: [10, 40],
      apronStaggerMmRange: [0, 12], // 北歐簡約，少錯開
      lowerStretcherStaggerMmRange: [0, 10],
      backTopRailHeightRange: [35, 60], // 細椅背
      lowerStretcherHeightRange: [130, 200],
      legPenetratingTenonProbability: 0.05, // 北歐藏榫
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [8, 14], // midCentury 招牌 Danish splay
      legSizeRatio: [0.85, 1.15],
      apronWidthRatio: [0.85, 1.15],
      seatThicknessRatio: [0.92, 1.15],
      legInsetRange: [15, 35],
      apronStaggerMmRange: [0, 12],
      lowerStretcherStaggerMmRange: [0, 10],
      lowerStretcherHeightRange: [100, 200],
      legPenetratingTenonProbability: 0.05,
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.95, 1.05],
    },
  },
  shaker: {
    "dining-chair": {
      backStyle: ["ladder", "slats"],
      stretcherStyle: ["h-frame", "side-only", "box"],
      backSlatsRange: [3, 5],
      ladderRungsRange: [3, 5],
      withArmrestProbability: 0.2,
      splayAngleRange: [2, 5],
      backRakeRange: [3, 8],
      legSizeRatio: [0.9, 1.1],
      apronWidthRatio: [0.85, 1.15],
      legInsetRange: [0, 12],
      apronStaggerMmRange: [0, 18],
      lowerStretcherStaggerMmRange: [0, 15],
      backTopRailHeightRange: [40, 65],
      lowerStretcherHeightRange: [150, 220],
      legPenetratingTenonProbability: 0.85, // Shaker 招牌通榫加楔片
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [2, 6], // Shaker 微外斜
      legSizeRatio: [0.9, 1.1],
      apronWidthRatio: [0.85, 1.15],
      seatThicknessRatio: [0.9, 1.15],
      legInsetRange: [0, 12],
      apronStaggerMmRange: [0, 18],
      lowerStretcherStaggerMmRange: [0, 15],
      lowerStretcherHeightRange: [100, 200],
      legPenetratingTenonProbability: 0.85,
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.95, 1.05],
    },
  },
  japanese: {
    "dining-chair": {
      backStyle: ["slats", "ladder", "splat"],
      stretcherStyle: ["side-only", "h-frame", "none"],
      backSlatsRange: [4, 8],
      ladderRungsRange: [3, 5],
      withArmrestProbability: 0.15,
      splayAngleRange: [0, 2], // 日式幾乎直腳
      legSizeRatio: [0.85, 1.1],
      apronWidthRatio: [0.8, 1.15],
      seatThicknessRatio: [0.9, 1.1],
      legInsetRange: [5, 20],
      seatCornerRRange: [0, 6],
      apronStaggerMmRange: [0, 8], // 日式極簡，幾乎不錯開
      lowerStretcherStaggerMmRange: [0, 8],
      backTopRailHeightRange: [35, 55], // 細椅背
      lowerStretcherHeightRange: [140, 200],
      legPenetratingTenonProbability: 0.05, // 和家具藏榫
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [0, 2], // 日式幾乎直腳
      legSizeRatio: [0.85, 1.1],
      apronWidthRatio: [0.8, 1.15],
      seatThicknessRatio: [0.9, 1.1],
      legInsetRange: [5, 20],
      apronStaggerMmRange: [0, 8],
      lowerStretcherStaggerMmRange: [0, 8],
      lowerStretcherHeightRange: [90, 180],
      legPenetratingTenonProbability: 0.05,
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.95, 1.05],
    },
  },
  mission: {
    "dining-chair": {
      backStyle: ["slats", "ladder"],
      stretcherStyle: ["h-frame", "box"],
      backSlatsRange: [4, 7],
      ladderRungsRange: [3, 5],
      withArmrestProbability: 0.35,
      splayAngleRange: [0, 0], // Mission 直角方腳
      backRakeRange: [3, 8],
      legSizeRatio: [1.0, 1.25], // Mission 粗腳
      apronWidthRatio: [0.95, 1.25], // 寬牙板
      legInsetRange: [0, 15],
      apronStaggerMmRange: [0, 20],
      lowerStretcherStaggerMmRange: [0, 18],
      backTopRailHeightRange: [55, 80], // Mission 椅背粗實
      lowerStretcherHeightRange: [130, 200],
      legPenetratingTenonProbability: 0.9, // Mission/Stickley 招牌穿釘通榫
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [0, 0], // Mission 直角方腳
      legSizeRatio: [1.0, 1.25], // Mission 粗腳明顯
      apronWidthRatio: [0.95, 1.25], // 寬牙板
      seatThicknessRatio: [0.95, 1.2], // 厚座板
      legInsetRange: [0, 10], // 端面切齊偏多
      apronStaggerMmRange: [0, 18],
      lowerStretcherStaggerMmRange: [0, 15],
      lowerStretcherHeightRange: [120, 200], // 偏高 H-frame
      legPenetratingTenonProbability: 0.9,
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.94, 1.06],
    },
  },
  windsor: {
    "dining-chair": {
      backStyle: ["windsor"],
      stretcherStyle: ["h-frame", "box", "side-only", "none"],
      withArmrestProbability: 0.5,
      splayAngleRange: [12, 18], // Windsor 極端外斜，跟 midCentury 8-14 不重疊
      backRakeRange: [8, 16],
      legSizeRatio: [0.7, 0.95], // Windsor 細腳
      seatThicknessRatio: [0.95, 1.2],
      legInsetRange: [20, 50],
      backInsetFromRearMmRange: [10, 30],
      seatCornerRRange: [10, 40],
      lowerStretcherStaggerMmRange: [0, 15], // windsor 沒牙條，只動下橫撐
      backTopRailHeightRange: [35, 55], // 細弓背
      lowerStretcherHeightRange: [130, 200],
      legPenetratingTenonProbability: 1.0, // Windsor 100% 通榫加楔
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [12, 18], // Windsor 極端外斜，跟 midCentury 8-14 不重疊
      legSizeRatio: [0.7, 0.95], // Windsor 細腳，比其他風格細
      seatThicknessRatio: [0.95, 1.2],
      legInsetRange: [20, 50],
      lowerStretcherStaggerMmRange: [0, 15],
      lowerStretcherHeightRange: [90, 200],
      legPenetratingTenonProbability: 1.0, // Windsor 通榫加楔
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.95, 1.05],
    },
  },
  ming: {
    "dining-chair": {
      backStyle: ["splat", "slats", "curved-splat"],
      stretcherStyle: ["box", "h-frame"],
      backSlatsRange: [3, 5],
      curvedSplatBendMmRange: [15, 30],
      withArmrestProbability: 0.7,
      splayAngleRange: [0, 2], // 明式直腳
      backRakeRange: [0, 5],
      legSizeRatio: [0.9, 1.15],
      apronWidthRatio: [0.85, 1.2],
      legInsetRange: [5, 20],
      backInsetFromRearMmRange: [10, 25],
      apronStaggerMmRange: [0, 15],
      lowerStretcherStaggerMmRange: [0, 12],
      backTopRailHeightRange: [50, 80], // 明式椅背中等到高
      lowerStretcherHeightRange: [140, 220],
      legPenetratingTenonProbability: 0.3, // 明式精緻多藏榫，偶爾露
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [0, 2], // 明式直腳
      legSizeRatio: [0.9, 1.15],
      apronWidthRatio: [0.85, 1.2],
      seatThicknessRatio: [0.9, 1.15],
      legInsetRange: [5, 20],
      apronStaggerMmRange: [0, 15],
      lowerStretcherStaggerMmRange: [0, 12],
      lowerStretcherHeightRange: [100, 200],
      legPenetratingTenonProbability: 0.3,
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.95, 1.05],
    },
  },
};

// ─── Hash + 抽樣 helpers ────────────────────────────────────────────────
function hash32(seed: number, salt: string): number {
  let h = (seed * 2654435761) >>> 0;
  for (let i = 0; i < salt.length; i++) h = ((h * 31) + salt.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function unitRand(seed: number, salt: string): number {
  return (hash32(seed, salt) % 100000) / 100000;
}

function pickFromArray<T>(arr: T[], seed: number, salt: string): T {
  return arr[hash32(seed, salt) % arr.length];
}

function pickRange(range: [number, number], seed: number, salt: string): number {
  const r = unitRand(seed, salt);
  return Math.round(range[0] + (range[1] - range[0]) * r);
}

function pickRangeFloat(range: [number, number], seed: number, salt: string): number {
  const r = unitRand(seed, salt);
  return range[0] + (range[1] - range[0]) * r;
}

export function getEffectivePool(styleId: string, category?: string): StyleVariantPool {
  if (!category) return DEFAULT_POOL;
  return STYLE_VARIANT_POOLS[styleId]?.[category] ?? DEFAULT_POOL;
}

/** 給定 seed > 0 + base params + base size，產出該風格隨機變體 overlay
 *  baseSize = 當前家具尺寸（用來算 ratio 後的新 size，length/width/height
 *  也包含在回傳 overlay 裡讓 caller 寫 URL）*/
export function sampleStyleVariant(
  styleId: string,
  category: string | undefined,
  variantSeed: number,
  baseSize: { length: number; width: number; height: number },
  baseParams: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  if (variantSeed <= 0) return {};
  const pool = getEffectivePool(styleId, category);
  const overlay: Record<string, string | number | boolean> = {};

  // 結構選擇
  if (pool.backStyle) overlay.backStyle = pickFromArray(pool.backStyle, variantSeed, "backStyle");
  if (pool.stretcherStyle) overlay.stretcherStyle = pickFromArray(pool.stretcherStyle, variantSeed, "stretcherStyle");
  if (pool.legShape) overlay.legShape = pickFromArray(pool.legShape, variantSeed, "legShape");
  if (pool.withArmrestProbability !== undefined) {
    overlay.withArmrest = unitRand(variantSeed, "withArmrest") < pool.withArmrestProbability;
  }
  if (pool.legPenetratingTenonProbability !== undefined) {
    overlay.legPenetratingTenon = unitRand(variantSeed, "legPenetratingTenon") < pool.legPenetratingTenonProbability;
  }

  // 計數型
  if (pool.backSlatsRange) overlay.backSlats = pickRange(pool.backSlatsRange, variantSeed, "backSlats");
  if (pool.ladderRungsRange) overlay.ladderRungs = pickRange(pool.ladderRungsRange, variantSeed, "ladderRungs");

  // 數值範圍（絕對值）
  if (pool.splayAngleRange) overlay.splayAngle = pickRange(pool.splayAngleRange, variantSeed, "splayAngle");
  if (pool.curvedSplatBendMmRange) overlay.curvedSplatBendMm = pickRange(pool.curvedSplatBendMmRange, variantSeed, "curvedSplatBendMm");
  if (pool.backRakeRange) overlay.backRake = pickRange(pool.backRakeRange, variantSeed, "backRake");
  if (pool.apronOffsetRange) overlay.apronOffset = pickRange(pool.apronOffsetRange, variantSeed, "apronOffset");
  if (pool.legInsetRange) overlay.legInset = pickRange(pool.legInsetRange, variantSeed, "legInset");
  if (pool.backInsetFromRearMmRange) overlay.backInsetFromRearMm = pickRange(pool.backInsetFromRearMmRange, variantSeed, "backInsetFromRearMm");
  if (pool.backInsetFromEndMmRange) overlay.backInsetFromEndMm = pickRange(pool.backInsetFromEndMmRange, variantSeed, "backInsetFromEndMm");
  if (pool.seatCornerRRange) overlay.seatCornerR = pickRange(pool.seatCornerRRange, variantSeed, "seatCornerR");
  // 錯開 + 高度（之前沒套：UI 有但變體不會用 → 使用者反饋）
  if (pool.apronStaggerMmRange) overlay.apronStaggerMm = pickRange(pool.apronStaggerMmRange, variantSeed, "apronStaggerMm");
  if (pool.lowerStretcherStaggerMmRange) overlay.lowerStretcherStaggerMm = pickRange(pool.lowerStretcherStaggerMmRange, variantSeed, "lowerStretcherStaggerMm");
  if (pool.backTopRailHeightRange) overlay.backTopRailHeight = pickRange(pool.backTopRailHeightRange, variantSeed, "backTopRailHeight");
  if (pool.lowerStretcherHeightRange) overlay.lowerStretcherHeight = pickRange(pool.lowerStretcherHeightRange, variantSeed, "lowerStretcherHeight");

  // ratio：base 值 × [lo, hi]
  if (pool.legSizeRatio && typeof baseParams.legSize === "number") {
    overlay.legSize = Math.round(baseParams.legSize * pickRangeFloat(pool.legSizeRatio, variantSeed, "legSize"));
  }
  if (pool.apronWidthRatio && typeof baseParams.apronWidth === "number" && baseParams.apronWidth > 0) {
    overlay.apronWidth = Math.round(baseParams.apronWidth * pickRangeFloat(pool.apronWidthRatio, variantSeed, "apronWidth"));
  }
  if (pool.seatThicknessRatio && typeof baseParams.seatThickness === "number") {
    overlay.seatThickness = Math.round(baseParams.seatThickness * pickRangeFloat(pool.seatThicknessRatio, variantSeed, "seatThickness"));
  }

  // 整體尺寸：用 category canonical 當錨點，**不用** URL current（baseSize）
  // 避免連按變體 length × 1.05 × 1.05 ... 複利暴衝。canonical 沒查到才 fallback。
  const anchor = getCanonicalSize(category) ?? baseSize;
  if (pool.lengthRatio) overlay.length = Math.round(anchor.length * pickRangeFloat(pool.lengthRatio, variantSeed, "length"));
  if (pool.widthRatio) overlay.width = Math.round(anchor.width * pickRangeFloat(pool.widthRatio, variantSeed, "width"));
  if (pool.heightRatio) overlay.height = Math.round(anchor.height * pickRangeFloat(pool.heightRatio, variantSeed, "height"));

  return overlay;
}

/** 列出所有 pool 可能寫入的 key——給 getAllStyleManagedKeys 用，切風格時要清掉。
 *  含 length/width/height（這 3 個 top-level 不在 optionSchema 裡，特別處理）*/
export function getAllPoolKeys(): Set<string> {
  return new Set([
    "backStyle", "stretcherStyle", "legShape", "withArmrest",
    "backSlats", "ladderRungs",
    "splayAngle", "curvedSplatBendMm", "backRake", "apronOffset", "legInset",
    "backInsetFromRearMm", "backInsetFromEndMm", "seatCornerR",
    "apronStaggerMm", "lowerStretcherStaggerMm",
    "backTopRailHeight", "lowerStretcherHeight",
    "legPenetratingTenon",
    "legSize", "apronWidth", "seatThickness",
    "length", "width", "height",
  ]);
}

// ─── 舊 API 保留 backward compat（已棄用，回 0 / null）────────────────
/** @deprecated 保留只為 import path 不爆，新代碼用 getEffectivePool / sampleStyleVariant */
export function getStyleVariantCount(_styleId: string, _category?: string): number {
  return 0;
}
/** @deprecated */
export function getStyleVariantOverlay(): Record<string, string | number | boolean> | null {
  return null;
}
