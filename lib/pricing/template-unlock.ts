/**
 * 單範本永久買斷定價（依難度分階）
 *
 * 為什麼分階：
 *   - 入門範本（方凳/筆筒）幾片板組成、工程圖薄，NT$199 跟雜誌單篇 PDF 對齊
 *   - 中階（餐椅/書桌）複雜度跳一層，材料/榫卯/工序頁數多，NT$299 站得住價值
 *   - 進階（衣櫃/餐桌）= 接案級藍圖,屋主接私下單一張都還賺,NT$499 對應市場
 *
 * 訂閱(月 390 / 年 3900) 跟單範本買斷是不同心理模式:
 *   - 訂閱 = 逛圖書館,適合「我會做很多家具」
 *   - 買斷 = 擁有藍圖,適合「我就想做這張」
 */

import type { FurnitureCategory } from "@/lib/types";
import { FURNITURE_CATALOG, type FurnitureCatalogEntry } from "@/lib/templates";

export type Difficulty = "beginner" | "intermediate" | "advanced";

/** 三階分級定價 */
export const TEMPLATE_UNLOCK_PRICES: Record<Difficulty, number> = {
  beginner: 199,
  intermediate: 299,
  advanced: 499,
};

/** 從 catalog 拉指定 category 的 entry */
export function getCatalogEntry(category: string): FurnitureCatalogEntry | null {
  return FURNITURE_CATALOG.find((e) => e.category === category) ?? null;
}

/** 取得單範本買斷價（找不到 category 時 null） */
export function getUnlockPrice(category: string): number | null {
  const entry = getCatalogEntry(category);
  if (!entry) return null;
  return TEMPLATE_UNLOCK_PRICES[entry.difficulty];
}

/** 取得難度（找不到 fallback intermediate） */
export function getDifficulty(category: string): Difficulty {
  const entry = getCatalogEntry(category);
  return entry?.difficulty ?? "intermediate";
}

/** 中文難度標籤 */
export const DIFFICULTY_LABEL_ZH: Record<Difficulty, string> = {
  beginner: "入門",
  intermediate: "中階",
  advanced: "進階",
};

/** 全範本套票（永久解鎖所有 26 個範本） */
export const ALL_TEMPLATES_BUNDLE_PRICE = 2999;
export const ALL_TEMPLATES_BUNDLE_LABEL = "全範本套票（永久）";
