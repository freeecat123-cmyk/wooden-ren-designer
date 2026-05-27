import {
  floorBomItemName,
  floorBomItemNote,
  floorBomItemSpec,
  type FloorBom,
} from "./types";
import type { EngineeringQuoteInput, EngLineItem } from "../engineering-quote/types";
import type { ENGINEERING_QUOTE_DEFAULTS } from "../engineering-quote/defaults";

type EngOpts = typeof ENGINEERING_QUOTE_DEFAULTS;

/** FloorBom → EngineeringQuoteInput。費用參數由 opts(報價表單)帶入。 */
export function floorBomToEngInput(
  bom: FloorBom,
  opts: EngOpts,
  locale: string = "zh-TW",
): EngineeringQuoteInput {
  const materialLines: EngLineItem[] = bom.items.map((it) => ({
    label: floorBomItemName(it, locale),
    detail:
      [floorBomItemSpec(it, locale), floorBomItemNote(it, locale)]
        .filter(Boolean)
        .join(" · ") || undefined,
    amount: it.subtotal ?? 0,
    unpriced: it.subtotal === undefined,
  }));

  return {
    quoteType: "floor",
    pingShu: bom.auto.pingShu,
    areaM2: bom.auto.roomAreaM2,
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
