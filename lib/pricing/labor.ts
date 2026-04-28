/**
 * 工資與雜項預設值（台灣職業木工 2024-25 行情）
 *
 * 時薪分級研究（訓練資料整理）：
 *   木工助理          NT$200–250/hr (日薪 1,800–2,200)
 *   一般職業木工      NT$350–500/hr (日薪 3,000–4,500)
 *   資深師傅          NT$500–800/hr (日薪 5,000–8,000)
 *   高階客製師傅      NT$800–1,500/hr
 *   頂級藝術木作      NT$2,000+/hr
 *
 * 預設採「資深師傅」級距下緣，適合大部分接案木工。
 */

export interface LaborDefaults {
  /** 主工匠時薪 NT$/hr */
  hourlyRate: number;
  /** 設備折舊分攤 NT$/hr（含電費、機具折舊） */
  equipmentRate: number;
  /** 每專案耗材（膠/砂紙/鑽頭磨耗等）NT$ */
  consumables: number;
  /** 塗裝費（護木油/蠟/漆 + 工時補加）NT$ */
  finishingCost: number;
  /** 運費 NT$ */
  shippingCost: number;
  /** 安裝費 NT$ */
  installationCost: number;
  /** 其他五金（鉸鏈/滑軌/把手）NT$ */
  hardwareCost: number;
  /** 毛利率（0–1） */
  marginRate: number;
  /** 營業稅率（0–1），開發票加計 */
  vatRate: number;
  /** 數量（相同家具做幾張），預設 1 */
  quantity: number;
  /** 折扣率（0–1），0 = 無折扣，0.05 = 95 折 */
  discountRate: number;
  /** 報價有效期天數，預設 14 */
  expiryDays: number;
  /** 訂金比例（0–1），預設 0.5 = 50%。列印頁自動拆「訂金 / 尾款」 */
  depositRate: number;
  /** 塗裝乾燥 + 出貨緩衝天數（除了實做工時外的等待時間），預設 7 */
  bufferDays: number;
  /** 手動覆寫「單件未稅報價」；0 表示不覆寫（沿用 cost+margin 計算）。用於議價場景 */
  overrideUnitPrice: number;
  /** 手動覆寫「總工時」(hr)；0 表示不覆寫（沿用 build steps + 倒角自動估算）。
   *  用於難度高/熟練度差/特殊要求的客製案件直接打總工時 */
  laborHoursOverride: number;
  /** 主材單價 (NT$/板才)——使用者輸入，頁面依所選木材預填 catalog 預設 */
  primaryMaterialPricePerBdft: number;
  /** 夾板單價 (NT$/板才)；null 表示不分開計價，背板/抽屜底板併入主材 */
  plywoodPricePerBdft: number | null;
  /** 中纖板單價 (NT$/板才)；null 表示不分開計價，抽屜側背板併入主材 */
  mdfPricePerBdft: number | null;
}

/**
 * 非主材相關的預設值。`primaryMaterialPricePerBdft` 必須由頁面依選定木材
 * 從 MATERIAL_PRICE_PER_BDFT 預填後傳入，所以這裡沒有它。
 */
export const LABOR_DEFAULTS: Omit<LaborDefaults, "primaryMaterialPricePerBdft"> = {
  hourlyRate: 500,
  equipmentRate: 50,
  consumables: 200,
  finishingCost: 1500,
  shippingCost: 0,
  installationCost: 0,
  hardwareCost: 0,
  marginRate: 0.3,
  vatRate: 0.05,
  quantity: 1,
  discountRate: 0,
  expiryDays: 14,
  depositRate: 0.5,
  bufferDays: 7,
  overrideUnitPrice: 0,
  laborHoursOverride: 0,
  // 預設為 null：背板、抽屜底板、抽屜側背板全部併入主材以主材單價計（木頭仁
  // 實務上材積報價不分材料種類）。想分開計的使用者可在報價表單自行填入。
  plywoodPricePerBdft: null,
  mdfPricePerBdft: null,
};

/** 合理範圍（表單 min/max） */
export const LABOR_BOUNDS = {
  hourlyRate: { min: 200, max: 2000, step: 50 },
  equipmentRate: { min: 0, max: 300, step: 10 },
  consumables: { min: 0, max: 2000, step: 50 },
  finishingCost: { min: 0, max: 20000, step: 100 },
  shippingCost: { min: 0, max: 30000, step: 100 },
  installationCost: { min: 0, max: 30000, step: 100 },
  hardwareCost: { min: 0, max: 50000, step: 100 },
  marginRate: { min: 0, max: 0.8, step: 0.05 },
  vatRate: { min: 0, max: 0.1, step: 0.01 },
  quantity: { min: 1, max: 100, step: 1 },
  discountRate: { min: 0, max: 0.5, step: 0.01 },
  expiryDays: { min: 1, max: 180, step: 1 },
  depositRate: { min: 0, max: 1, step: 0.05 },
  bufferDays: { min: 0, max: 60, step: 1 },
  overrideUnitPrice: { min: 0, max: 1000000, step: 100 },
  laborHoursOverride: { min: 0, max: 500, step: 0.5 },
  primaryMaterialPricePerBdft: { min: 20, max: 3000, step: 10 },
  plywoodPricePerBdft: { min: 5, max: 150, step: 5 },
  mdfPricePerBdft: { min: 5, max: 150, step: 5 },
} as const;
