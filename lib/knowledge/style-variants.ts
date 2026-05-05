/**
 * 風格 × 家具 結構性變體（structural variants）
 *
 * 重複按同一風格按鈕時，第 N 次按 → 套用該風格 + 該家具的第 (N-1) % len 組
 * overlay。每組 overlay 只列出「跟 base detail pack 不同」的 key，其他都繼承
 * base pack。
 *
 * 設計原則：
 *   - 不動尺寸數值（legSize / apronWidth / seatThickness 等）— 那些是風格識
 *     別的核心
 *   - 動結構選擇：backStyle / 計數型（backSlats / ladderRungs）/ stretcherStyle
 *     / withArmrest / splayAngle 在合理範圍內變化
 *   - 每組 variant 必須在該風格的「合理性」之內（不是隨機）
 *
 * 沒列在這裡的 (style, category) 組合：variantSeed > 0 不變化（v2 = v1）
 */
export const STYLE_STRUCTURAL_VARIANTS: Record<
  string,
  Record<string, Array<Record<string, string | number | boolean>>>
> = {
  industrial: {
    "dining-chair": [
      // v2: ladder 3 條 + box 田字形橫撐
      { backStyle: "ladder", ladderRungs: 3, stretcherStyle: "box", lowerStretcherHeight: 200 },
      // v3: slats 4 條 + side-only 雙側橫撐
      { backStyle: "slats", backSlats: 4, slatWidth: 35, stretcherStyle: "side-only", backRake: 3 },
      // v4: ladder 4 + 加扶手
      { backStyle: "ladder", ladderRungs: 4, withArmrest: true, armrestHeight: 200, stretcherStyle: "h-frame" },
    ],
    "bar-stool": [
      { backStyle: "rail", footrestHeight: 320 },
      { backStyle: "slats", backSlats: 3, footrestHeight: 380 },
      { backStyle: "none", footrestHeight: 350 },
    ],
  },
  chippendale: {
    "dining-chair": [
      // v2: 改 splat 中板，splayed 5°
      { backStyle: "splat", splatWidth: 220, backRake: 10, splayAngle: 0, legShape: "tapered" },
      // v3: 加扶手
      { backStyle: "splat", splatWidth: 240, withArmrest: true, armrestHeight: 220, backRake: 8 },
      // v4: ladder 4
      { backStyle: "ladder", ladderRungs: 4, backRake: 6 },
    ],
  },
  midCentury: {
    "dining-chair": [
      // v2: 5 條直條 + h-frame，斜腳更明顯
      { backStyle: "slats", backSlats: 5, slatWidth: 35, splayAngle: 10, stretcherStyle: "h-frame", lowerStretcherHeight: 220 },
      // v3: 曲面中板
      { backStyle: "curved-splat", curvedSplatWidth: 240, curvedSplatBendMm: 25, splayAngle: 6, stretcherStyle: "none" },
      // v4: 直條 4 條 + 加扶手
      { backStyle: "slats", backSlats: 4, slatWidth: 38, withArmrest: true, armrestHeight: 210, splayAngle: 7 },
    ],
    "bar-stool": [
      { backStyle: "panel", backPanelHeight: 220, backPanelCornerR: 40, splayAngle: 8 },
      { backStyle: "slats", backSlats: 3, splayAngle: 10 },
      { backStyle: "none", splayAngle: 6 },
    ],
  },
  shaker: {
    "dining-chair": [
      // v2: ladder 改 3 條 + side-only 橫撐
      { backStyle: "ladder", ladderRungs: 3, stretcherStyle: "side-only" },
      // v3: 改 slats 直條
      { backStyle: "slats", backSlats: 4, slatWidth: 40, stretcherStyle: "h-frame" },
      // v4: ladder 5 條
      { backStyle: "ladder", ladderRungs: 5, stretcherStyle: "box" },
    ],
  },
  japanese: {
    "dining-chair": [
      // v2: 改 5 條更寬
      { backStyle: "slats", backSlats: 5, slatWidth: 30, stretcherStyle: "h-frame" },
      // v3: 改 ladder
      { backStyle: "ladder", ladderRungs: 4, stretcherStyle: "side-only" },
      // v4: 改 splat
      { backStyle: "splat", splatWidth: 180, stretcherStyle: "side-only" },
    ],
  },
  mission: {
    "dining-chair": [
      // v2: ladder 4 條
      { backStyle: "ladder", ladderRungs: 4, stretcherStyle: "box" },
      // v3: slats 改 5 條較寬
      { backStyle: "slats", backSlats: 5, slatWidth: 40, stretcherStyle: "h-frame" },
      // v4: 加扶手
      { backStyle: "slats", backSlats: 5, withArmrest: true, armrestHeight: 210, stretcherStyle: "box" },
    ],
  },
  windsor: {
    "dining-chair": [
      // v2: 加扶手 + h-frame
      { backStyle: "windsor", withArmrest: true, armrestHeight: 220, stretcherStyle: "h-frame", splayAngle: 10 },
      // v3: 改 box 田字形
      { backStyle: "windsor", stretcherStyle: "box", splayAngle: 8 },
      // v4: 改 spindle 較少 + side-only
      { backStyle: "windsor", stretcherStyle: "side-only", splayAngle: 12 },
    ],
  },
  ming: {
    "dining-chair": [
      // v2: 改直條
      { backStyle: "slats", backSlats: 5, slatWidth: 30, stretcherStyle: "h-frame" },
      // v3: 改曲面中板
      { backStyle: "curved-splat", curvedSplatWidth: 220, curvedSplatBendMm: 20, stretcherStyle: "box" },
      // v4: 加扶手
      { backStyle: "splat", splatWidth: 220, withArmrest: true, armrestHeight: 220, stretcherStyle: "box" },
    ],
  },
};

/** 給定 style + category，回傳該組合的所有 variant overlay 數量。0 = 沒定義變體（v2 = v1）*/
export function getStyleVariantCount(styleId: string, category?: string): number {
  if (!category) return 0;
  const list = STYLE_STRUCTURAL_VARIANTS[styleId]?.[category];
  return list?.length ?? 0;
}

/** 拿第 N 組 variant overlay。N = variantSeed - 1（因 seed 0 = base）。
 *  超過 length 自動 cycle（modulo）。沒定義回 null */
export function getStyleVariantOverlay(
  styleId: string,
  category: string | undefined,
  variantSeed: number,
): Record<string, string | number | boolean> | null {
  if (!category || variantSeed <= 0) return null;
  const list = STYLE_STRUCTURAL_VARIANTS[styleId]?.[category];
  if (!list || list.length === 0) return null;
  return list[(variantSeed - 1) % list.length];
}
