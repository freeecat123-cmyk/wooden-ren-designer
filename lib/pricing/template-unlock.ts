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

/**
 * 套組買斷：幾支範本打包成一個商品，買一次全部解鎖。
 * 2026-09-08 木頭仁：「丙級三個要打包成一個一起賣，一起買斷就是丙級的三個都有，價格是 290」。
 * 結帳時 raw_response.categories 帶整組，綠界回呼對每一支各寫一列 template_unlocks，
 * 權限判定（canAccessCategory）不用改。
 */
export interface TemplateBundle {
  id: string;
  nameZh: string;
  categories: FurnitureCategory[];
  price: number;
}
export const TEMPLATE_BUNDLES: TemplateBundle[] = [
  {
    id: "cert-bundle",
    nameZh: "家具木工丙級檢定 三題套組",
    categories: ["cert-c1", "cert-c2", "cert-c3"],
    price: 290,
  },
];

/** 這支範本屬於哪個套組（沒有就 null） */
export function getBundleFor(category: string): TemplateBundle | null {
  return TEMPLATE_BUNDLES.find((b) => b.categories.includes(category as FurnitureCategory)) ?? null;
}

/** 買這支範本實際會解鎖的 category 清單（套組＝整組，否則只有自己） */
export function getUnlockCategories(category: string): string[] {
  return getBundleFor(category)?.categories ?? [category];
}

/** 取得單範本買斷價（套組成員回套組價；找不到 category 時 null） */
export function getUnlockPrice(category: string): number | null {
  const bundle = getBundleFor(category);
  if (bundle) return bundle.price;
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
