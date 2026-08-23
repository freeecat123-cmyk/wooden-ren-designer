import type { DemolitionMode, ConsumablesMode } from "./types";

/** 工程報價費用參數預設值(使用者可在報價表單調整)。
 *  數字為台灣裝潢市場保守估,使用者必調。 */
export const ENGINEERING_QUOTE_DEFAULTS = {
  laborPricePerPing: 0,
  demolitionMode: "lump" as DemolitionMode,
  demolitionLump: 0,
  demolitionPerPing: 0,
  shippingCost: 0,
  consumablesMode: "lump" as ConsumablesMode,
  consumablesLump: 0,
  consumablesPercent: 0.05,
  /** 天花板每坪材料費(adapter 用) */
  ceilingMaterialPerPing: 0,
  paintingPerPing: 0,
  marginRate: 0.2,
  vatRate: 0.05,
  discountRate: 0,
  depositRate: 0.3,
  validityDays: 30,
};

/**
 * 費率的合法範圍。
 *
 * ⛔ 表單上的 `NumField` 有 `Math.max(0, …)`，所以打不進負數 —— 但**列印頁的
 *    報價參數是從網址 `?o=` 解出來的**（`decodeState` 只做 base64 + JSON.parse，
 *    零驗證），完全繞過表單。列印頁是**要交到客戶手上**的那張單。
 *
 *    實測改網址就能做出：總價 −73,198、訂金比總價還多 3 倍、整張單 NaN。
 *    連結是分享出去的（給客戶看報價），也可能是舊版本留下的過期連結。（2026-08-23）
 */
export const ENG_RATE_BOUNDS = {
  marginRate: { min: 0, max: 5 },        // 毛利 0–500%
  discountRate: { min: 0, max: 0.5 },    // 折扣 0–50%（跟表單同一條線）
  vatRate: { min: 0, max: 0.5 },         // 稅率 0–50%
  depositRate: { min: 0, max: 1 },       // 訂金不可能超過總價
  consumablesPercent: { min: 0, max: 1 },
} as const;

/** 非負金額欄位：網址塞負數 / 文字 / null 都要擋掉 */
const ENG_NON_NEGATIVE = [
  "laborPricePerPing", "demolitionLump", "demolitionPerPing", "shippingCost",
  "consumablesLump", "ceilingMaterialPerPing", "paintingPerPing", "validityDays",
] as const;

/**
 * 把來路不明的報價參數（網址、舊連結、手改過的）洗成安全值。
 *
 * 規則：不是有限數字 → 退回預設值；是數字 → 夾進合法範圍。
 * **不丟例外** —— 列印頁寧可印出一張合理的單，也不要整頁掛掉。
 */
export function sanitizeEngQuoteOpts(
  raw: unknown,
): typeof ENGINEERING_QUOTE_DEFAULTS {
  const D = ENGINEERING_QUOTE_DEFAULTS;
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...D };

  for (const [k, v] of Object.entries(src)) {
    if (!(k in D)) continue; // 網址塞不認得的欄位 → 直接無視
    const def = (D as Record<string, unknown>)[k];
    if (typeof def === "number") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) continue; // 文字 / null / NaN → 留預設值
      const b = (ENG_RATE_BOUNDS as Record<string, { min: number; max: number }>)[k];
      out[k] = b
        ? Math.min(b.max, Math.max(b.min, n))
        : (ENG_NON_NEGATIVE as readonly string[]).includes(k)
          ? Math.max(0, n)
          : n;
    } else if (typeof def === "string") {
      if (typeof v === "string") out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out as typeof ENGINEERING_QUOTE_DEFAULTS;
}
