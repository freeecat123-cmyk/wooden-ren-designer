/**
 * 木紋方向結構合理性檢查（MVP）
 *
 * 規則：受力構件（椅腳/桌腳/橫撐/榫頭）木紋必須沿長軸方向。
 * 違反 → 橫紋抗拉只有順紋的 1/20–1/40，一掰就斷。
 *
 * 詳細規則 docs/drafting-math.md §L5（P0-1 順紋承載）。
 *
 * 注意：當前所有 templates 都把 leg 類部件設成 grainDirection="length"，
 * 這份檢查主要是 future-proof（防止自由設計模式或新模板寫錯）。
 */

import { categorizePart } from "@/lib/render/svg-views";

export interface GrainWarning {
  partId: string;
  partName: string;
  level: "ERROR";
  message: string;
  suggest: string;
}

interface PartLite {
  id: string;
  nameZh: string;
  grainDirection: "length" | "width" | "thickness";
  visible: { length: number; width: number; thickness: number };
}

/** 受力構件 — 木紋必須沿長軸 */
const STRUCTURAL_CATEGORIES = new Set(["leg", "apron", "stretcher"]);

export function checkGrainDirection(parts: PartLite[]): GrainWarning[] {
  const warnings: GrainWarning[] = [];
  for (const part of parts) {
    const cat = categorizePart(part.id);
    if (!STRUCTURAL_CATEGORIES.has(cat)) continue;

    // 部件的「長軸」由 visible 三軸最大者決定
    const { length, width, thickness } = part.visible;
    const max = Math.max(length, width, thickness);
    let longestAxis: "length" | "width" | "thickness";
    if (max === length) longestAxis = "length";
    else if (max === width) longestAxis = "width";
    else longestAxis = "thickness";

    if (part.grainDirection !== longestAxis) {
      warnings.push({
        partId: part.id,
        partName: part.nameZh,
        level: "ERROR",
        message: `${part.nameZh} 木紋方向（${part.grainDirection}）與長軸（${longestAxis}）不符`,
        suggest: "受力構件必須順紋——橫紋抗拉只有順紋 1/20，一掰就斷",
      });
    }
  }
  return warnings;
}
