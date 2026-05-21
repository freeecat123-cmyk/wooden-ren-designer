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
