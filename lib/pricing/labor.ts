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
  /** 毛利率（0–1） */
  marginRate: number;
  /** 營業稅率（0–1），開發票加計 */
  vatRate: number;
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
  marginRate: 0.3,
  vatRate: 0.05,
  plywoodPricePerBdft: 20,
  mdfPricePerBdft: 15,
};

/** 合理範圍（表單 min/max） */
export const LABOR_BOUNDS = {
  hourlyRate: { min: 200, max: 2000, step: 50 },
  equipmentRate: { min: 0, max: 300, step: 10 },
  consumables: { min: 0, max: 2000, step: 50 },
  finishingCost: { min: 0, max: 20000, step: 100 },
  marginRate: { min: 0, max: 0.8, step: 0.05 },
  vatRate: { min: 0, max: 0.1, step: 0.01 },
  primaryMaterialPricePerBdft: { min: 20, max: 3000, step: 10 },
  plywoodPricePerBdft: { min: 5, max: 150, step: 5 },
  mdfPricePerBdft: { min: 5, max: 150, step: 5 },
} as const;
