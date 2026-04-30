/**
 * 風格 detail pack 的「情境適應器」（contextual adapter）。
 *
 * 為什麼需要：靜態 detail pack 是好的「典型值」，但同樣風格在不同尺寸 /
 * 材質下，最佳參數會不同。例如：
 * - Shaker chest 1500mm 高跟 600mm 高，腳粗 / drawer 高度應不同
 * - Mid-Century 餐桌 1400mm 跟 2400mm，legSize 應 scale up
 * - 套 Shaker 但選了胡桃木（深色），有些值該偏 Mid-Century 一點
 *
 * 這個 adapter 在 applyStylePreset 之後跑，吃 (base params, ctx) 回出
 * 經過 size/material/category 微調的最終 params。
 *
 * 不用 LLM——純規則 + 公式。AI 微調由 /api/style-suggest 另外處理。
 */

import { walkerDrawerHeights } from "./proportion-rules";

interface AdaptContext {
  /** 家具總長 mm（dimensions.length）*/
  totalLength: number;
  /** 家具總寬 mm */
  totalWidth: number;
  /** 家具總高 mm */
  totalHeight: number;
  /** 主材 id */
  material?: string;
  /** 家具類別 */
  category: string;
}

type StyleParams = Record<string, string | number | boolean>;

// ═══════════════════════════════════════════════════════════════════
// 公式 helpers
// ═══════════════════════════════════════════════════════════════════

/** 給一個尺寸的家具，回傳合理 legSize（根據 wood-master/structure_strength.md
 *  桌腳截面積 ≥ 桌面面積 × 0.5%）。簡化成 sqrt(totalArea × 0.005) */
function computeMinLegSize(lengthMm: number, widthMm: number): number {
  const areaMm2 = lengthMm * widthMm;
  const minSectionMm2 = areaMm2 * 0.005;
  return Math.round(Math.sqrt(minSectionMm2));
}

/** 線性 scale：給原值 + 基準尺寸 + 當前尺寸，回傳 scale 後的值 */
function scaleByDim(baseValue: number, baseDim: number, currentDim: number, factor = 0.5): number {
  // factor=0 不 scale，1 完全跟著線性
  const ratio = currentDim / baseDim;
  return Math.round(baseValue * (1 + (ratio - 1) * factor));
}

// ═══════════════════════════════════════════════════════════════════
// 主 adapter
// ═══════════════════════════════════════════════════════════════════

export function adaptStyleParams(
  baseParams: StyleParams,
  ctx: AdaptContext,
): { params: StyleParams; notes: string[] } {
  const params = { ...baseParams };
  const notes: string[] = [];

  // ── 規則 1：legSize 隨家具總尺寸 scale ──────────────────────────────
  if (typeof params.legSize === "number") {
    const minRequired = computeMinLegSize(ctx.totalLength, ctx.totalWidth);
    const original = params.legSize;
    if (original < minRequired) {
      params.legSize = minRequired;
      notes.push(`legSize ${original}→${minRequired}（依結構規則桌腳截面 ≥ 桌面面積 × 0.5%，原值不夠粗）`);
    }
    // 桌類大件 (totalLength > 1800) 額外加 10-20%
    if (
      (ctx.category === "dining-table" || ctx.category === "desk") &&
      ctx.totalLength > 1800
    ) {
      const scaled = Math.round(Math.max(params.legSize, original) * 1.15);
      if (scaled > params.legSize) {
        params.legSize = scaled;
        notes.push(`legSize 加 15%（桌長 ${ctx.totalLength}mm 偏大，視覺需粗腳平衡）`);
      }
    }
  }

  // ── 規則 2：apronWidth 隨家具高 scale（高家具該配粗牙條）────────────
  if (typeof params.apronWidth === "number" && params.apronWidth > 0) {
    if (ctx.totalHeight > 800 && ctx.category === "dining-table") {
      const scaled = scaleByDim(params.apronWidth, 750, ctx.totalHeight, 0.4);
      if (scaled > params.apronWidth) {
        const original = params.apronWidth;
        params.apronWidth = scaled;
        notes.push(`apronWidth ${original}→${scaled}（桌高 ${ctx.totalHeight}mm 高於常規 750，牙條跟著粗）`);
      }
    }
  }

  // ── 規則 3：櫃類用 Walker drawer rule（總抽屜 ≥ 4 才套）──────────────
  if (ctx.category === "chest-of-drawers") {
    const topCount = Number(params.topCount ?? 0);
    const midCount = Number(params.midCount ?? 0);
    const bottomCount = Number(params.bottomCount ?? 0);
    const totalDrawers = topCount + midCount + bottomCount;
    if (
      totalDrawers >= 4 &&
      params.topType === "drawer" &&
      params.midType === "drawer" &&
      params.bottomType === "drawer"
    ) {
      // 用 Walker 比例分配 zone 高度
      // 上 zone = 最小，下 zone = 最大
      const totalH = ctx.totalHeight - Number(params.legHeight ?? 0) - 18 * 2; // 扣腳 + 頂底板
      if (totalH > 600) {
        const zoneHeights = walkerDrawerHeights(totalH, 3); // 3 zones
        params.topHeight = zoneHeights[0];
        params.bottomHeight = zoneHeights[2];
        notes.push(`套 Walker 比例（4:5:6）分配 zone 高：上 ${zoneHeights[0]} / 中自動 / 下 ${zoneHeights[2]}`);
      }
    }
  }

  // ── 規則 4：seatEdge 隨座板厚 scale ────────────────────────────────
  if (typeof params.seatEdge === "number" && typeof params.seatThickness === "number") {
    const maxEdge = Math.floor(params.seatThickness * 0.5);
    if (params.seatEdge > maxEdge) {
      const original = params.seatEdge;
      params.seatEdge = maxEdge;
      notes.push(`seatEdge ${original}→${maxEdge}（座板厚 ${params.seatThickness}mm，倒邊不能超過厚度一半）`);
    }
  }

  // ── 規則 5：材質衝突柔性提示（不改 params，只記 note） ──────────────
  if (ctx.material) {
    const darkWoods = ["walnut", "teak"];
    const lightWoods = ["maple", "ash", "pine", "douglas-fir", "taiwan-cypress"];
    const oakish = ["white-oak"];
    const styleId = String(params._styleId ?? "");
    if (styleId === "shaker" && darkWoods.includes(ctx.material)) {
      notes.push(`材質提示：Shaker 傳統用 cherry/maple/pine 等淺色，目前選 ${ctx.material} 偏 Mid-Century 風`);
    }
    if (styleId === "midCentury" && oakish.includes(ctx.material)) {
      notes.push(`材質提示：Mid-Century 招牌是 walnut / teak，white-oak 偏 Mission`);
    }
  }

  return { params, notes };
}
