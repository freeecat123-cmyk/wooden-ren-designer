/**
 * 人體工學常數（身高 → 家具尺寸）。
 *
 * Source: wood-master/knowledge/books_english_classics.md §4.1
 * （Schwarz pinky knuckle 工作台公式）+ books_workshop_manuals.md §4
 * （FWW 椅子幾何）+ hand_tools.md §6.2.1（工作台高度）。
 *
 * 使用情境：UI 加 input「您的身高？」→ 自動推薦座高 / 桌高 / 工作台高
 */

// ═══════════════════════════════════════════════════════════════════
// 身高 → 家具高度的回歸係數
// 來源：彙整 Schwarz / FWW / 人體工學教科書經驗值
// ═══════════════════════════════════════════════════════════════════

/** 工作台高度公式：身高 × 0.49（手肘下 100mm）
 *  Source: books_english_classics.md §4.1（Schwarz "pinky knuckle" rule）
 *  170cm → 833；175cm → 858；180cm → 882 mm */
export function workbenchByHeight(heightCm: number): number {
  return Math.round(heightCm * 10 * 0.49);
}

/** 餐桌椅座高公式：身高 × 0.27（人體工學一般共識）
 *  Source: books_workshop_manuals.md §4.1
 *  155cm → 419；165cm → 446；175cm → 473 mm */
export function diningSeatByHeight(heightCm: number): number {
  return Math.round(heightCm * 10 * 0.27);
}

/** 餐桌高度公式：座高 + 280mm gap（FWW 共識）
 *  165cm → 446 + 280 = 726；175cm → 473 + 280 = 753 mm */
export function diningTableByHeight(heightCm: number): number {
  return diningSeatByHeight(heightCm) + 280;
}

/** 書桌 / 辦公桌高度公式：身高 × 0.43（略低於餐桌，腿空間夠）
 *  Source: 人體工學文獻 + 木匠學院經驗
 *  165cm → 710；175cm → 753 mm */
export function deskByHeight(heightCm: number): number {
  return Math.round(heightCm * 10 * 0.43);
}

/** 廚房料理台高度公式：身高 × 0.55（站立操作，比餐桌高）
 *  Source: 廚具人體工學共識
 *  165cm → 908；175cm → 963 mm */
export function kitchenCounterByHeight(heightCm: number): number {
  return Math.round(heightCm * 10 * 0.55);
}

// ═══════════════════════════════════════════════════════════════════
// 家具尺寸 → 身高的反推（驗證用）
// ═══════════════════════════════════════════════════════════════════

/** 給工作台高，反推合適身高範圍（cm）。允許 ±5cm 寬容度 */
export function userHeightForWorkbench(workbenchMm: number): { min: number; max: number } {
  const heightCm = (workbenchMm / 10) / 0.49;
  return { min: Math.round(heightCm - 5), max: Math.round(heightCm + 5) };
}

// ═══════════════════════════════════════════════════════════════════
// 預設身高（亞洲 / 台灣中位數）
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_USER_HEIGHT_CM = {
  /** 台灣男性平均（衛福部 2018）*/
  male: 172,
  /** 台灣女性平均 */
  female: 160,
  /** UI 預設值：取中位數 */
  default: 165,
} as const;

/**
 * 工作桌「桌高用途」係數（身高 × 係數 = 建議桌面高）。
 * plane 手刨 ≈ 掌根高、machine 機具／組裝 ≈ 肘下 10cm、fine 精細作業（鑿榫、鳩尾）、
 * assembly 組裝／上漆矮桌。outfeed（桌鋸出料台）不看身高，看桌鋸台面。
 * ⭐ 模板（lib/templates/workbench.ts）與設計頁表單（DesignFormShell 自動套用桌高）
 *    共用這一份，不要各寫一套。
 */
export const WORKBENCH_HEIGHT_COEF: Record<string, number> = {
  plane: 0.49,
  machine: 0.55,
  fine: 0.60,
  assembly: 0.44,
};

/** 依用途與身高算建議桌高（mm）。outfeed 模式回桌鋸台面 −2。 */
export function workbenchHeightFor(
  heightMode: string,
  userHeightCm: number,
  sawTableHeightMm = 870,
): number {
  if (heightMode === "outfeed") return Math.round(sawTableHeightMm) - 2;
  const coef = WORKBENCH_HEIGHT_COEF[heightMode] ?? WORKBENCH_HEIGHT_COEF.plane;
  return Math.round(userHeightCm * 10 * coef);
}
