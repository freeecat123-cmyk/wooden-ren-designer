/**
 * 工程報價(地板 / 天花板共用)。以「坪」為計價基準,與材料種類無關。
 * 家具報價走 lib/pricing/quote.ts,與本模組互不相干。
 */

export type EngQuoteType = "floor" | "ceiling";

/** 報價單上的一行品項 */
export interface EngLineItem {
  label: string;
  detail?: string;
  /** NT$;未報價時為 0,搭配 unpriced 旗標 */
  amount: number;
  /** true → 列印顯示「未報價」灰字 */
  unpriced?: boolean;
}

/** 工程報價輸入(adapter 產出 + 使用者在報價表單填的費用參數) */
export interface EngineeringQuoteInput {
  quoteType: EngQuoteType;
  /** 坪數,由 BOM 帶入,UI 唯讀 */
  pingShu: number;
  areaM2: number;

  /** 材料總成本(地板 = BOM 加總;天花板 = 每坪材料 × 坪數) */
  materialCost: number;
  /** 材料明細(顯示用) */
  materialLines: EngLineItem[];

  /** 每坪施工費(NT$/坪) */
  laborPricePerPing: number;

  /** 拆除清運 */
  demolitionMode: "lump" | "perPing";
  demolitionLump: number;
  demolitionPerPing: number;

  /** 運費(定額) */
  shippingCost: number;

  /** 雜項耗材 */
  consumablesMode: "lump" | "percent";
  consumablesLump: number;
  /** 對 materialCost 取百分比(0–1) */
  consumablesPercent: number;

  /** 天花板批土油漆(每坪);quoteType="floor" 時計算端強制為 0 */
  paintingPerPing: number;

  /** 毛利率 0–1 */
  marginRate: number;
  /** 營業稅率,預設 0.05 */
  vatRate: number;
  /** 折扣率 0–0.5 */
  discountRate: number;
  /** 訂金比例 0–1,預設 0.3 */
  depositRate: number;
  /** 報價有效天數 */
  validityDays: number;
}

/** 工程報價計算結果 */
export interface EngineeringQuoteBreakdown {
  materialCost: number;
  laborCost: number;
  demolitionCost: number;
  shippingCost: number;
  consumablesCost: number;
  /** floor 恆為 0 */
  paintingCost: number;
  costSubtotal: number;
  margin: number;
  subtotalExclVat: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  vat: number;
  total: number;
  depositAmount: number;
  balanceAmount: number;
  /** 完整品項表(材料明細 + 各費用行) */
  lines: EngLineItem[];
  /** 任一必要單價(材料 / 施工費)= 0 → true */
  hasUnpriced: boolean;
}
