import type { CeilingBom } from "./types";
import type { EngineeringQuoteInput, EngLineItem } from "../engineering-quote/types";
import type { ENGINEERING_QUOTE_DEFAULTS } from "../engineering-quote/defaults";

type EngOpts = typeof ENGINEERING_QUOTE_DEFAULTS;

/**
 * CeilingBom → EngineeringQuoteInput。
 * 天花板材料用「每坪材料費」估價(materialPerPing × 坪數),
 * BOM 逐項數量轉成材料行的 detail 摘要供師傅核對。
 */
export function ceilingBomToEngInput(
  bom: CeilingBom,
  materialPerPing: number,
  opts: EngOpts,
): EngineeringQuoteInput {
  const ping = bom.auto.pingShu;
  const materialCost = Math.round(materialPerPing * ping);

  const summary = bom.items
    .map((it) => `${it.nameZh} ${it.count}`)
    .join("、");

  const materialLines: EngLineItem[] = [
    {
      label: "天花板系統材料",
      detail: `每坪 NT$${materialPerPing.toLocaleString()} × ${ping} 坪(${summary})`,
      amount: materialCost,
      unpriced: materialPerPing <= 0,
    },
  ];

  return {
    quoteType: "ceiling",
    pingShu: ping,
    areaM2: bom.auto.roomAreaM2,
    materialCost,
    materialLines,
    laborPricePerPing: opts.laborPricePerPing,
    demolitionMode: opts.demolitionMode,
    demolitionLump: opts.demolitionLump,
    demolitionPerPing: opts.demolitionPerPing,
    shippingCost: opts.shippingCost,
    consumablesMode: opts.consumablesMode,
    consumablesLump: opts.consumablesLump,
    consumablesPercent: opts.consumablesPercent,
    paintingPerPing: opts.paintingPerPing,
    marginRate: opts.marginRate,
    vatRate: opts.vatRate,
    discountRate: opts.discountRate,
    depositRate: opts.depositRate,
    validityDays: opts.validityDays,
  };
}
