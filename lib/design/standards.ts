/**
 * 台灣木材市場規格對齊
 *
 * 設計值 vs 市售規格的差距 hint。詳細規格表 docs/drafting-math.md §T。
 */

/** 台灣常見板材厚度（mm）。中間值通常買不到，要刨光或拼接 */
export const STANDARD_THICKNESSES_MM = [3, 6, 9, 12, 15, 18, 24, 25, 30, 38] as const;

/** 厚度容忍：±0.5mm 視為「就是這個規格」 */
const TOLERANCE_MM = 0.5;

/** 找最接近的市售厚度。回傳 { spec, delta }；delta = 設計值 − 規格值（正=要刨薄、負=要拼厚） */
export function nearestStandardThickness(value: number): { spec: number; delta: number } {
  let best: number = STANDARD_THICKNESSES_MM[0];
  let bestDist = Math.abs(value - best);
  for (const t of STANDARD_THICKNESSES_MM) {
    const d = Math.abs(value - t);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return { spec: best, delta: Number((value - best).toFixed(1)) };
}

/** 是否已對齊市售規格（在容忍範圍內） */
export function isStandardThickness(value: number): boolean {
  return STANDARD_THICKNESSES_MM.some((t) => Math.abs(value - t) <= TOLERANCE_MM);
}

export interface ThicknessHint {
  /** 多少件部件用到這個厚度 */
  count: number;
  /** 設計值 mm */
  designValue: number;
  /** 市售最接近規格 mm */
  standard: number;
  /** 差值（正=要刨薄，負=要拼厚或選下一級） */
  delta: number;
}

/**
 * 掃描設計用到的所有厚度，回傳每個未對齊規格的 hint。
 * 已對齊的不回傳。
 */
export function collectThicknessHints(
  parts: Array<{ visible: { thickness: number } }>,
): ThicknessHint[] {
  const counts = new Map<number, number>();
  for (const p of parts) {
    const t = Math.round(p.visible.thickness * 10) / 10; // 1 位小數 group
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const hints: ThicknessHint[] = [];
  for (const [thickness, count] of counts) {
    if (isStandardThickness(thickness)) continue;
    const { spec, delta } = nearestStandardThickness(thickness);
    hints.push({ count, designValue: thickness, standard: spec, delta });
  }
  // 多用的厚度排前面
  hints.sort((a, b) => b.count - a.count);
  return hints;
}
