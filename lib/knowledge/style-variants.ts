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
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
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
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
  },
  midCentury: {
    "dining-chair": {
      backStyle: ["slats", "curved-splat"],
      stretcherStyle: ["none", "h-frame"],
      backSlatsRange: [3, 6],
      curvedSplatBendMmRange: [15, 35],
      withArmrestProbability: 0.3,
      splayAngleRange: [4, 10],
      backRakeRange: [3, 10],
      legSizeRatio: [0.85, 1.15],
      apronWidthRatio: [0.85, 1.15],
      seatThicknessRatio: [0.92, 1.15],
      legInsetRange: [15, 35],
      backInsetFromRearMmRange: [0, 15],
      backInsetFromEndMmRange: [0, 15],
      seatCornerRRange: [10, 40],
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
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
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
  },
  japanese: {
    "dining-chair": {
      backStyle: ["slats", "ladder", "splat"],
      stretcherStyle: ["side-only", "h-frame", "none"],
      backSlatsRange: [4, 8],
      ladderRungsRange: [3, 5],
      withArmrestProbability: 0.15,
      splayAngleRange: [0, 3],
      legSizeRatio: [0.85, 1.1],
      apronWidthRatio: [0.8, 1.15],
      seatThicknessRatio: [0.9, 1.1],
      legInsetRange: [5, 20],
      seatCornerRRange: [0, 6],
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
  },
  mission: {
    "dining-chair": {
      backStyle: ["slats", "ladder"],
      stretcherStyle: ["h-frame", "box"],
      backSlatsRange: [4, 7],
      ladderRungsRange: [3, 5],
      withArmrestProbability: 0.35,
      splayAngleRange: [0, 3],
      backRakeRange: [3, 8],
      legSizeRatio: [0.9, 1.15],
      apronWidthRatio: [0.85, 1.15],
      legInsetRange: [0, 15],
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
  },
  windsor: {
    "dining-chair": {
      backStyle: ["windsor"],
      stretcherStyle: ["h-frame", "box", "side-only", "none"],
      withArmrestProbability: 0.5,
      splayAngleRange: [6, 14],
      backRakeRange: [8, 16],
      legSizeRatio: [0.85, 1.1],
      seatThicknessRatio: [0.95, 1.2],
      legInsetRange: [20, 50],
      backInsetFromRearMmRange: [10, 30],
      seatCornerRRange: [10, 40],
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
  },
  ming: {
    "dining-chair": {
      backStyle: ["splat", "slats", "curved-splat"],
      stretcherStyle: ["box", "h-frame"],
      backSlatsRange: [3, 5],
      curvedSplatBendMmRange: [15, 30],
      withArmrestProbability: 0.7,
      splayAngleRange: [0, 3],
      backRakeRange: [0, 5],
      legSizeRatio: [0.9, 1.15],
      apronWidthRatio: [0.85, 1.2],
      legInsetRange: [5, 20],
      backInsetFromRearMmRange: [10, 25],
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
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

  // 整體尺寸（不在 baseParams 裡，傳 baseSize 進來）
  if (pool.lengthRatio) overlay.length = Math.round(baseSize.length * pickRangeFloat(pool.lengthRatio, variantSeed, "length"));
  if (pool.widthRatio) overlay.width = Math.round(baseSize.width * pickRangeFloat(pool.widthRatio, variantSeed, "width"));
  if (pool.heightRatio) overlay.height = Math.round(baseSize.height * pickRangeFloat(pool.heightRatio, variantSeed, "height"));

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
