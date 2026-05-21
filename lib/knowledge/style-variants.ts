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
import type { OptionSpec, OptionDependency } from "@/lib/types";

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
  // farmhouse = 美式手工（Farmhouse / Mission / Windsor 合併款）。
  // 之前漏寫此 key，連椅凳都退回 DEFAULT_POOL → 重複按只變顏色。
  // 範圍橫跨 Mission 粗實直腳到 Windsor 細外斜，rustic 多裸露榫頭。
  farmhouse: {
    "dining-chair": {
      backStyle: ["ladder", "slats", "windsor"],
      stretcherStyle: ["h-frame", "box", "side-only"],
      backSlatsRange: [3, 6],
      ladderRungsRange: [2, 4],
      withArmrestProbability: 0.35,
      splayAngleRange: [0, 10],
      backRakeRange: [3, 12],
      legSizeRatio: [0.9, 1.25],
      apronWidthRatio: [0.85, 1.25],
      seatThicknessRatio: [0.95, 1.2],
      legInsetRange: [0, 25],
      seatCornerRRange: [0, 14],
      apronStaggerMmRange: [0, 22],
      lowerStretcherStaggerMmRange: [0, 18],
      backTopRailHeightRange: [45, 80],
      lowerStretcherHeightRange: [120, 220],
      legPenetratingTenonProbability: 0.8, // rustic 愛裸露穿榫
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.97, 1.03],
    },
    "stool": {
      splayAngleRange: [0, 10],
      legSizeRatio: [0.9, 1.25],
      apronWidthRatio: [0.85, 1.25],
      seatThicknessRatio: [0.95, 1.2],
      legInsetRange: [0, 25],
      apronStaggerMmRange: [0, 22],
      lowerStretcherStaggerMmRange: [0, 18],
      lowerStretcherHeightRange: [90, 200],
      legPenetratingTenonProbability: 0.8,
      lengthRatio: [0.9, 1.1],
      widthRatio: [0.9, 1.1],
      heightRatio: [0.94, 1.06],
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

  // 整體尺寸：variant 不再 override length/width/height
  // 原因：使用者「業界常用」按鈕設過 2400×900，再按同風格進變體被 canonical
  // 1500×850 × ratio 覆蓋會丟掉使用者選擇。整體尺寸尊重使用者，
  // variant 只變 stylistic 細節（legSize / apronWidth / 結構 etc.）。
  // void anchor & ratio pool to silence unused（如未來要恢復 size variant，
  // 改成「user 沒明確設過才套」）
  void getCanonicalSize;
  void baseSize;
  void pool.lengthRatio;
  void pool.widthRatio;
  void pool.heightRatio;

  return overlay;
}

// ─── 通用變體（所有家具類型）────────────────────────────────────────────
// hand-coded STYLE_VARIANT_POOLS 只覆蓋 dining-chair / stool。其餘 26 種家具
// 之前退回 DEFAULT_POOL → 只有 legSize/apronWidth 微調 → 使用者反饋「重複按
// 同一風格只會變顏色」。通用變體改成直接讀模板自己的 OptionSpec[]，對每個
// 選項在其宣告的範圍內抽樣，讓任何家具都有真正的結構 + 尺寸變化。

/** 風格識別 key：base preset 已依風格設定，變體不要亂抽否則「同風格」會走鐘。 */
const GENERIC_VARIANT_DENY = new Set<string>([
  "legShape", "seatProfile",
  "legEdgeStyle", "seatEdgeStyle", "topEdgeStyle", "stretcherEdgeStyle",
  "splayAngle",
]);

/** 該選項是否排除在通用變體之外（風格識別 key + 配置預設選擇器 + override 鈕）。 */
function isGenericVariantDeny(spec: OptionSpec): boolean {
  if (GENERIC_VARIANT_DENY.has(spec.key)) return true;
  if (spec.group === "preset") return true; // 一鍵配置預設不亂抽
  // *Override 類「0=自動、否則強制」語意鈕，亂抽會強制成奇怪值 → 留預設
  if (/[Oo]verride/.test(spec.key)) return true;
  return false;
}

function evalDepLocal(
  dep: OptionDependency,
  values: Record<string, string | number | boolean>,
): boolean {
  if (dep.all) return dep.all.every((d) => evalDepLocal(d, values));
  if (dep.any) return dep.any.some((d) => evalDepLocal(d, values));
  if (!dep.key) return true;
  const v = values[dep.key];
  if (dep.notIn && dep.notIn.includes(v as string | number | boolean)) return false;
  if (dep.oneOf && !dep.oneOf.includes(v as string | number | boolean)) return false;
  if (dep.equals !== undefined && v !== dep.equals) return false;
  if (dep.equals === undefined && dep.notIn === undefined && dep.oneOf === undefined && !v) return false;
  return true;
}

/** 通用變體可寫入的 key——切風格時要連同 managed key 一起清掉避免殘留。 */
export function getGenericVariantKeys(optionSchema: OptionSpec[]): string[] {
  return optionSchema.filter((s) => !isGenericVariantDeny(s)).map((s) => s.key);
}

/**
 * 通用變體：對任何模板的 OptionSpec[] 抽樣。
 * - select  → 從 choices（依 dependsOn 過濾後）hash 抽一個
 * - checkbox→ hash 決定 true/false
 * - number  → 在 [min, max]（缺則 default ±20%）內 hash 抽值、對齊 step
 * dependsOn 用「已抽樣 + 預設」的 values 評估，跳過當下不該顯示的選項。
 */
export function sampleGenericVariant(
  optionSchema: OptionSpec[],
  variantSeed: number,
): Record<string, string | number | boolean> {
  if (variantSeed <= 0 || optionSchema.length === 0) return {};
  // 先用各選項預設值鋪一份完整 values，dependsOn 才評得準
  const values: Record<string, string | number | boolean> = {};
  for (const s of optionSchema) values[s.key] = s.defaultValue;
  const overlay: Record<string, string | number | boolean> = {};

  for (const spec of optionSchema) {
    if (isGenericVariantDeny(spec)) continue;
    if (spec.dependsOn && !evalDepLocal(spec.dependsOn, values)) continue;

    if (spec.type === "select") {
      const choices = spec.choices.filter(
        (c) => !c.dependsOn || evalDepLocal(c.dependsOn, values),
      );
      if (choices.length <= 1) continue;
      const picked = choices[hash32(variantSeed, spec.key) % choices.length].value;
      overlay[spec.key] = picked;
      values[spec.key] = picked;
    } else if (spec.type === "checkbox") {
      const picked = unitRand(variantSeed, spec.key) < 0.5;
      overlay[spec.key] = picked;
      values[spec.key] = picked;
    } else {
      const omin = spec.min ?? Math.round(spec.defaultValue * 0.8);
      const omax = spec.max ?? Math.round(spec.defaultValue * 1.2);
      if (omax <= omin) continue;
      // 中段抽樣：兩端各砍 15%，避免抽到 min/max 退化極值（如 5mm 椅腳）
      const span = omax - omin;
      const lo = omin + span * 0.15;
      const hi = omax - span * 0.15;
      const step = spec.step ?? 1;
      let v = lo + (hi - lo) * unitRand(variantSeed, spec.key);
      v = Math.round(v / step) * step;
      v = Math.min(omax, Math.max(omin, v));
      overlay[spec.key] = v;
      values[spec.key] = v;
    }
  }
  return overlay;
}

/** 列出所有 pool 可能寫入的 key——給 getAllStyleManagedKeys 用，切風格時要清掉。
 *  length/width/height 已從 variant overlay 拿掉（尊重使用者業界常用選擇），
 *  此處也不再列入 managed → 切風格時不會清掉使用者的尺寸 */
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
