import type { BillableMaterial, MaterialId, SheetGood } from "@/lib/types";

/**
 * 木材單價表 (NT$ / 板才)
 *
 * 板才 (board foot) = 1" × 12" × 12" = 144 in³
 *                    = 25.4 × 25.4 × 25.4 × 144 mm³
 *                    ≈ 2,359,737 mm³
 *
 * 預設值沿用使用者（木頭仁）原本熟悉的數字，不自動換算倍率；
 * 實際進貨價以使用者在表單輸入為準。
 */
export const MM3_PER_BDFT = 25.4 * 25.4 * 25.4 * 144; // ≈ 2,359,737

export const MATERIAL_PRICE_PER_BDFT: Record<MaterialId, number> = {
  "taiwan-cypress": 1000,
  walnut: 250,
  "white-oak": 200,
  maple: 150,
  ash: 150,
  beech: 120,
  pine: 80,
  teak: 300, // 估算（使用者未提供）
  "douglas-fir": 90, // 估算（花旗松比松木略貴）
  // —— 板材類（裝潢用）——
  // 換算：一張 2400×1200×18mm = 21.97 板才；單張價 / 21.97 = 每板才價
  // 注意：現實是「整張買」，半張也付全張錢。短期用 bdft 估價；
  // TODO: 之後改 per-sheet 計價（根據 cut-plan 算出 ceil(N 張) × 單張價）
  "blockboard-primary": 27, // 木芯板（NT$ 600 / 張 18mm）
  "plywood-primary": 50, // 夾板裝潢用（NT$ 1100 / 張 18mm）
  "mdf-primary": 27, // 中纖板（NT$ 600 / 張 18mm）
};

/**
 * 板材單價表 (NT$ / 板才)
 *
 * 夾板、中纖板用於背板、抽屜底板、抽屜側背板等非結構零件。
 * 換算：18mm 4×8 ft 一張 = 21.97 板才；單張價 / 21.97 = 每板才。
 * 板材實際是按整張賣，bdft 是估算用，跟主材的 *-primary 採同樣校正。
 */
export const SHEET_GOOD_PRICE_PER_BDFT: Record<SheetGood, number> = {
  plywood: 50, // NT$ 1100 / 張 18mm
  mdf: 27, // NT$ 600 / 張 18mm
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
  return MATERIAL_PRICE_PER_BDFT[m] ?? 300;
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
