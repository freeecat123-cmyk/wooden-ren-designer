import type { MaterialId } from "@/lib/types";

/**
 * 木材單價表 (NT$ / 才)
 *
 * 才 = 台才 = 1 台寸 × 1 台寸 × 1 台尺
 *     = 30.303mm × 30.303mm × 303.03mm
 *     = 278,190 mm³
 *
 * 使用者（木頭仁）提供的實際進貨/零售價：
 *   檜木 1000, 胡桃木 250, 楓木 150, 梣木 150,
 *   白橡 200, 山毛櫸 120, 松木 80
 * 未提供者由類似樹種估算。
 */
export const MM3_PER_TSAI = 30.303 * 30.303 * 303.03; // ≈ 278,190

export const MATERIAL_PRICE_PER_TSAI: Record<MaterialId, number> = {
  "taiwan-cypress": 1000,
  walnut: 250,
  "white-oak": 200,
  maple: 150,
  ash: 150,
  beech: 120,
  pine: 80,
  teak: 300, // 估算（使用者未提供）
  "douglas-fir": 90, // 估算（花旗松比松木略貴）
};

export function mm3ToTsai(volumeMm3: number): number {
  return volumeMm3 / MM3_PER_TSAI;
}

/** 報價中顯示用：兩位小數的「才」 */
export function formatTsai(tsai: number): string {
  return tsai.toFixed(2);
}

/** 格式化新台幣金額，附千分位 */
export function formatTWD(amount: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}
