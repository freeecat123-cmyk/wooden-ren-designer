import type { BillableMaterial, MaterialId, SheetGood } from "@/lib/types";

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

/**
 * 板材單價表 (NT$ / 才)
 *
 * 夾板、中纖板用於背板、抽屜底板、抽屜側背板等非結構零件——
 * 實際師傅不會全實木，才價落差 4–8 倍。以零售裁切價估：
 *   5–6mm 夾板    ~NT$20/才
 *   9mm 中纖板    ~NT$15/才
 */
export const SHEET_GOOD_PRICE_PER_TSAI: Record<SheetGood, number> = {
  plywood: 20,
  mdf: 15,
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

/** 取得某計價材料的才價，允許表單覆寫板材價 */
export function priceForMaterial(
  m: BillableMaterial,
  sheetOverrides?: Partial<Record<SheetGood, number>>,
): number {
  if (m === "plywood" || m === "mdf") {
    return sheetOverrides?.[m] ?? SHEET_GOOD_PRICE_PER_TSAI[m];
  }
  return MATERIAL_PRICE_PER_TSAI[m] ?? 300;
}

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
