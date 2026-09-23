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

interface LabelCopy {
  labor: string;
  laborDetailTpl: (per: string, ping: number) => string;
  demolition: string;
  shipping: string;
  consumables: string;
  painting: string;
  paintingDetailTpl: (per: string, ping: number) => string;
}

const LABEL_COPY: Record<"zhTW" | "en", LabelCopy> = {
  zhTW: {
    labor: "施工費",
    laborDetailTpl: (per, ping) => `每坪 ${per} × ${ping} 坪`,
    demolition: "拆除清運費",
    shipping: "運費",
    consumables: "雜項耗材",
    painting: "天花板批土油漆",
    paintingDetailTpl: (per, ping) => `每坪 ${per} × ${ping} 坪`,
  },
  en: {
    labor: "Labor",
    laborDetailTpl: (per, ping) => `${per}/ping × ${ping} ping`,
    demolition: "Demolition & disposal",
    shipping: "Shipping",
    consumables: "Consumables",
    painting: "Plaster & paint (ceiling)",
    paintingDetailTpl: (per, ping) => `${per}/ping × ${ping} ping`,
  },
};

export function computeEngineeringQuote(
  input: EngineeringQuoteInput,
  locale: string = "zh-TW",
): EngineeringQuoteBreakdown {
  const C = locale === "en" ? LABEL_COPY.en : LABEL_COPY.zhTW;
  const fmtPer = (n: number) => {
    if (locale === "en") {
      // unit prices passed in TWD; convert to USD for EN locale
      const usdAmt = n / 32;
      return `$${usdAmt.toFixed(2)}`;
    }
    return `NT$${n.toLocaleString()}`;
  };
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
    label: C.labor,
    detail: C.laborDetailTpl(fmtPer(input.laborPricePerPing), input.pingShu),
    amount: laborCost,
    unpriced: input.laborPricePerPing <= 0,
  });
  if (demolitionCost > 0) lines.push({ label: C.demolition, amount: demolitionCost });
  if (shippingCost > 0) lines.push({ label: C.shipping, amount: shippingCost });
  if (consumablesCost > 0) lines.push({ label: C.consumables, amount: consumablesCost });
  if (paintingCost > 0) {
    lines.push({
      label: C.painting,
      detail: C.paintingDetailTpl(fmtPer(input.paintingPerPing), input.pingShu),
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
