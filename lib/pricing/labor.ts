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
  /** 每專案耗材（膠/砂紙/護木油/鑽頭磨耗等）NT$ */
  consumables: number;
  /** 毛利率（0–1） */
  marginRate: number;
  /** 營業稅率（0–1），開發票加計 */
  vatRate: number;
  /** 夾板才價覆寫 (NT$/才)，背板/抽屜底板計價用 */
  plywoodPricePerTsai: number;
  /** 中纖板才價覆寫 (NT$/才)，抽屜側背板計價用 */
  mdfPricePerTsai: number;
}

export const LABOR_DEFAULTS: LaborDefaults = {
  hourlyRate: 500,
  equipmentRate: 50,
  consumables: 200,
  marginRate: 0.3,
  vatRate: 0.05,
  plywoodPricePerTsai: 20,
  mdfPricePerTsai: 15,
};

/** 合理範圍（表單 min/max） */
export const LABOR_BOUNDS = {
  hourlyRate: { min: 200, max: 2000, step: 50 },
  equipmentRate: { min: 0, max: 300, step: 10 },
  consumables: { min: 0, max: 2000, step: 50 },
  marginRate: { min: 0, max: 0.8, step: 0.05 },
  vatRate: { min: 0, max: 0.1, step: 0.01 },
  plywoodPricePerTsai: { min: 5, max: 150, step: 5 },
  mdfPricePerTsai: { min: 5, max: 150, step: 5 },
} as const;
