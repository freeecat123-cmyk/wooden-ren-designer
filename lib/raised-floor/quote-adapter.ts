/**
 * RaisedFloorBom → EngineeringQuoteInput
 *
 * 和室架高平台估價走 /floor /ceiling 同一套 EngineeringQuote 模組:
 *   - 材料明細 = BOM 5 行(面材 / 主支 / 副支 / 夾板 / 踢腳)
 *   - materialCost = bom.cost.total
 *   - pingShu / areaM2 = bom.auto.pingShu / bom.auto.platformAreaM2
 */
import type { RaisedFloorBom } from "./types";
import type { EngineeringQuoteInput, EngLineItem } from "../engineering-quote/types";
import type { ENGINEERING_QUOTE_DEFAULTS } from "../engineering-quote/defaults";

type EngOpts = typeof ENGINEERING_QUOTE_DEFAULTS;

export function raisedFloorBomToEngInput(
  bom: RaisedFloorBom,
  opts: EngOpts,
): EngineeringQuoteInput {
  const materialLines: EngLineItem[] = bom.items.map((it) => {
    const qty =
      it.count != null
        ? `${it.count} 片`
        : it.totalLengthM != null
          ? `${it.totalLengthM.toFixed(1)} m`
          : "";
    const detail = [it.spec, qty, it.note].filter(Boolean).join(" · ") || undefined;
    return {
      label: it.nameZh,
      detail,
      amount: it.subtotal ?? 0,
      unpriced: it.subtotal === undefined,
    };
  });

  return {
    // 共用 "floor" quoteType:UI 標題/付款條件按地板邏輯顯示,
    // EngineeringQuoteForm 才不會跳出天花板專屬的「每坪材料費」欄位。
    quoteType: "floor",
    pingShu: bom.auto.pingShu,
    areaM2: bom.auto.platformAreaM2,
    materialCost: bom.cost.total,
    materialLines,
    laborPricePerPing: opts.laborPricePerPing,
    demolitionMode: opts.demolitionMode,
    demolitionLump: opts.demolitionLump,
    demolitionPerPing: opts.demolitionPerPing,
    shippingCost: opts.shippingCost,
    consumablesMode: opts.consumablesMode,
    consumablesLump: opts.consumablesLump,
    consumablesPercent: opts.consumablesPercent,
    paintingPerPing: 0,
    marginRate: opts.marginRate,
    vatRate: opts.vatRate,
    discountRate: opts.discountRate,
    depositRate: opts.depositRate,
    validityDays: opts.validityDays,
  };
}
