import type {
  EngineeringQuoteInput,
  EngineeringQuoteBreakdown,
  EngLineItem,
} from "./types";

/** 報價有效日 = 報價日 + validityDays(以台北日曆日計)。回傳 YYYY-MM-DD。 */
export function computeValidUntil(validityDays: number, today = new Date()): string {
  const target = new Date(today.getTime() + validityDays * 86400000);
  // en-CA locale 直接輸出 YYYY-MM-DD,時區鎖台北
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);
}

export function computeEngineeringQuote(
  input: EngineeringQuoteInput,
): EngineeringQuoteBreakdown {
  const r = (n: number) => Math.round(n);

  const materialCost = r(input.materialCost);
  const laborCost = r(input.laborPricePerPing * input.pingShu);
  const demolitionCost = r(
    input.demolitionMode === "lump"
      ? input.demolitionLump
      : input.demolitionPerPing * input.pingShu,
  );
  const shippingCost = r(input.shippingCost);
  const consumablesCost = r(
    input.consumablesMode === "lump"
      ? input.consumablesLump
      : input.materialCost * input.consumablesPercent,
  );
  const paintingCost = r(
    input.quoteType === "ceiling" ? input.paintingPerPing * input.pingShu : 0,
  );

  const costSubtotal =
    materialCost + laborCost + demolitionCost + shippingCost + consumablesCost + paintingCost;
  const margin = r(costSubtotal * input.marginRate);
  const subtotalExclVat = costSubtotal + margin;
  const discountAmount = r(subtotalExclVat * input.discountRate);
  const subtotalAfterDiscount = subtotalExclVat - discountAmount;
  const vat = r(subtotalAfterDiscount * input.vatRate);
  const total = subtotalAfterDiscount + vat;
  const depositAmount = r(total * input.depositRate);
  const balanceAmount = total - depositAmount;

  // 品項表:材料明細 + 各費用行
  const lines: EngLineItem[] = [...input.materialLines];
  lines.push({
    label: "施工費",
    detail: `每坪 NT$${input.laborPricePerPing.toLocaleString()} × ${input.pingShu} 坪`,
    amount: laborCost,
    unpriced: input.laborPricePerPing <= 0,
  });
  if (demolitionCost > 0) lines.push({ label: "拆除清運費", amount: demolitionCost });
  if (shippingCost > 0) lines.push({ label: "運費", amount: shippingCost });
  if (consumablesCost > 0) lines.push({ label: "雜項耗材", amount: consumablesCost });
  if (paintingCost > 0) {
    lines.push({
      label: "天花板批土油漆",
      detail: `每坪 NT$${input.paintingPerPing.toLocaleString()} × ${input.pingShu} 坪`,
      amount: paintingCost,
    });
  }

  const hasUnpriced =
    input.materialLines.some((l) => l.unpriced) || input.laborPricePerPing <= 0;

  return {
    materialCost,
    laborCost,
    demolitionCost,
    shippingCost,
    consumablesCost,
    paintingCost,
    costSubtotal,
    margin,
    subtotalExclVat,
    discountAmount,
    subtotalAfterDiscount,
    vat,
    total,
    depositAmount,
    balanceAmount,
    lines,
    hasUnpriced,
  };
}
