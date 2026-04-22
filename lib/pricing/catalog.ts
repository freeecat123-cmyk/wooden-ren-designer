import type { BillableMaterial, MaterialId, SheetGood } from "@/lib/types";

/**
 * 木材單價表 (NT$ / 板才)
 *
 * 板才 (board foot) = 1" × 12" × 12" = 144 in³
 *                    = 25.4 × 25.4 × 25.4 × 144 mm³
 *                    ≈ 2,359,737 mm³
 *
 * 1 板才 ≈ 8.5 台才（1 台才 ≈ 278 cm³），因此台才價 × 8.5 ≈ 板才價。
 * 預設值以使用者（木頭仁）的台才進貨價換算：
 *   檜木 1000/才 → ~8500/板才
 *   胡桃木 250/才 → ~2100/板才
 *   白橡 200/才 → ~1700/板才
 *   楓木/梣木 150/才 → ~1300/板才
 *   山毛櫸 120/才 → ~1000/板才
 *   松木 80/才 → ~680/板才
 */
export const MM3_PER_BDFT = 25.4 * 25.4 * 25.4 * 144; // ≈ 2,359,737

export const MATERIAL_PRICE_PER_BDFT: Record<MaterialId, number> = {
  "taiwan-cypress": 8500,
  walnut: 2100,
  "white-oak": 1700,
  maple: 1300,
  ash: 1300,
  beech: 1000,
  pine: 680,
  teak: 2500, // 估算（使用者未提供）
  "douglas-fir": 760, // 估算（花旗松比松木略貴）
};

/**
 * 板材單價表 (NT$ / 板才)
 *
 * 夾板、中纖板用於背板、抽屜底板、抽屜側背板等非結構零件。
 *   5–6mm 夾板     ~NT$170/板才（= 台才 20）
 *   9mm 中纖板     ~NT$130/板才（= 台才 15）
 */
export const SHEET_GOOD_PRICE_PER_BDFT: Record<SheetGood, number> = {
  plywood: 170,
  mdf: 130,
};

export const SHEET_GOOD_LABEL: Record<SheetGood, string> = {
  plywood: "夾板",
  mdf: "中纖板",
};

/** 零件實際計價材料：有 override 就用 override，否則用主材 */
export function effectiveBillableMaterial<
  P extends { material: MaterialId; materialOverride?: SheetGood },
>(part: P): BillableMaterial {
  return part.materialOverride ?? part.material;
}

/** 取得某計價材料的單價，允許表單覆寫板材價 */
export function priceForMaterial(
  m: BillableMaterial,
  sheetOverrides?: Partial<Record<SheetGood, number>>,
): number {
  if (m === "plywood" || m === "mdf") {
    return sheetOverrides?.[m] ?? SHEET_GOOD_PRICE_PER_BDFT[m];
  }
  return MATERIAL_PRICE_PER_BDFT[m] ?? 2000;
}

export function mm3ToBdft(volumeMm3: number): number {
  return volumeMm3 / MM3_PER_BDFT;
}

/** 報價顯示用：兩位小數的「板才」 */
export function formatBdft(bdft: number): string {
  return bdft.toFixed(2);
}

/** 格式化新台幣金額，附千分位 */
export function formatTWD(amount: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}
