/**
 * 比例規則（古典美學的視覺數學）。
 *
 * Source: wood-master/knowledge/books_design_proportions.md（Walker & Tolpin
 * 《By Hand & Eye》/《From Truths to Tools》/ Roubo / Moxon / Vitruvius）+
 * books_chinese_classics.md §2（明式 module）。
 *
 * 規則：
 * - 純 utility：不掛 URL params，由 template 內部呼叫
 * - 每個函式回傳「比例陣列」，由 caller 換算實際 mm
 * - 每塊都標 Source 段，bot 答題能對到 wood-master
 */

// ═══════════════════════════════════════════════════════════════════
// Walker Drawer Rule（古典抽屜遞增比例）
// Source: books_design_proportions.md §5.3（George Walker 18 世紀英式 chest）
// ═══════════════════════════════════════════════════════════════════

/** 古典 4 抽屜 chest 由上到下高度比 — Walker《By Hand & Eye》招牌
 *  最上抽最淺（放小物 / 飾品），最下抽最深（放衣物） */
export const WALKER_DRAWER_4 = [4, 5, 6, 7] as const;

/** 5 抽屜延伸比例（Walker 的線性遞增邏輯延展） */
export const WALKER_DRAWER_5 = [4, 5, 6, 7, 8] as const;

/** 6 抽屜延伸比例 */
export const WALKER_DRAWER_6 = [3, 4, 5, 6, 7, 8] as const;

/** 給定總高 + 抽屜數，回傳每個抽屜的高度（按 Walker 比例分配） */
export function walkerDrawerHeights(totalHeightMm: number, drawerCount: number): number[] {
  const ratios = drawerCount === 4 ? WALKER_DRAWER_4
    : drawerCount === 5 ? WALKER_DRAWER_5
    : drawerCount === 6 ? WALKER_DRAWER_6
    // 其他抽屜數：用線性遞增（首=2、末=2+drawerCount-1）
    : Array.from({ length: drawerCount }, (_, i) => 2 + i);
  const sum = ratios.reduce((a, b) => a + b, 0);
  return ratios.map((r) => Math.round((r / sum) * totalHeightMm));
}

// ═══════════════════════════════════════════════════════════════════
// 黃金比 / Whole Number 比例
// Source: books_design_proportions.md §2（古典三大比例家族）
// ═══════════════════════════════════════════════════════════════════

/** 黃金比 ≈ 1.618 — 古希臘建築 / Palladio 偏好 */
export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

/** 1:√2 ≈ 1.414 — A 系列紙張（A4 / A3）+ 日式畳的比例 */
export const SQRT2_RATIO = Math.sqrt(2);

/** 古典 whole-number 比例家族（Walker 推崇）— 視覺都「順眼」
 *  1:1（正方）/ 2:3 / 3:4 / 3:5 / 4:5 / 5:8 ≈ 黃金比 */
export const WHOLE_NUMBER_RATIOS = [
  [1, 1],
  [2, 3],
  [3, 4],
  [3, 5],
  [4, 5],
  [5, 8], // ≈ 黃金比
] as const;

/** 給長度，按黃金比回傳寬（高 / 寬 = φ）。例：書桌長 1300 → 寬 ~803mm */
export function goldenWidth(lengthMm: number): number {
  return Math.round(lengthMm / GOLDEN_RATIO);
}

/** 給寬度，按黃金比回傳長 */
export function goldenLength(widthMm: number): number {
  return Math.round(widthMm * GOLDEN_RATIO);
}

// ═══════════════════════════════════════════════════════════════════
// 明式 module（中式古典模數）
// Source: books_chinese_classics.md §2（王世襄《明式家具研究》module 系統）
// ═══════════════════════════════════════════════════════════════════

/** 明式椅子的「module」邏輯：
 *  - 椅腿截面 = 1 module（M）
 *  - 牙條高度 = 1.5-2M
 *  - 椅面厚 = 0.7-0.8M
 *  - 椅背高 = 5-6M（從座面起）
 *  - 椅寬 = 12-14M（座面寬）
 *  - 椅深 = 11-13M
 *
 *  使用：先決定 legSize（M 值），其他尺寸 × ratio 自動算
 *  Source: books_chinese_classics.md §2.2（圈椅模數）
 */
export const MING_CHAIR_MODULE = {
  apronWidthRatio: 1.75,    // 1.5-2M
  seatThicknessRatio: 0.75, // 0.7-0.8M
  backHeightRatio: 5.5,     // 5-6M
  seatWidthRatio: 13,       // 12-14M
  seatDepthRatio: 12,       // 11-13M
} as const;

/** 給 module（=legSize），回傳明式椅子各尺寸 */
export function mingChairDims(moduleMm: number) {
  return {
    apronWidthMm: Math.round(moduleMm * MING_CHAIR_MODULE.apronWidthRatio),
    seatThicknessMm: Math.round(moduleMm * MING_CHAIR_MODULE.seatThicknessRatio),
    backHeightMm: Math.round(moduleMm * MING_CHAIR_MODULE.backHeightRatio),
    seatWidthMm: Math.round(moduleMm * MING_CHAIR_MODULE.seatWidthRatio),
    seatDepthMm: Math.round(moduleMm * MING_CHAIR_MODULE.seatDepthRatio),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 桌椅人體工學的比例驗證
// Source: books_workshop_manuals.md §4 + books_chairmaking.md §3
// ═══════════════════════════════════════════════════════════════════

/** 桌椅高度比 ≈ 1.67 (750 / 450)，接近黃金比 1.618。
 *  寬鬆驗證：給定桌椅高，回傳「比例感分數」（0-100，60+ = 順眼） */
export function tableChairHarmonyScore(tableHeightMm: number, seatHeightMm: number): number {
  const ratio = tableHeightMm / seatHeightMm;
  const distFromGolden = Math.abs(ratio - GOLDEN_RATIO);
  // 距黃金比 0.05 內滿分，0.3 外為 0
  return Math.max(0, Math.round(100 * (1 - distFromGolden / 0.3)));
}
