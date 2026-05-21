/** 跑法:npx tsx lib/engineering-quote/calc.test.ts */
import { computeEngineeringQuote, computeValidUntil } from "./calc";
import type { EngineeringQuoteInput } from "./types";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}
function approx(a: number, b: number, eps = 0.5) {
  return Math.abs(a - b) < eps;
}

const base: EngineeringQuoteInput = {
  quoteType: "floor",
  pingShu: 10,
  areaM2: 33.06,
  materialCost: 30000,
  materialLines: [{ label: "地板片", amount: 30000 }],
  laborPricePerPing: 2000,
  demolitionMode: "lump",
  demolitionLump: 5000,
  demolitionPerPing: 0,
  shippingCost: 1500,
  consumablesMode: "lump",
  consumablesLump: 2000,
  consumablesPercent: 0,
  paintingPerPing: 0,
  marginRate: 0.2,
  vatRate: 0.05,
  discountRate: 0,
  depositRate: 0.3,
  validityDays: 30,
};

// 1. 地板基本加總
{
  const b = computeEngineeringQuote(base);
  // 材料30000 + 施工2000×10=20000 + 拆除5000 + 運費1500 + 雜項2000 = 58500
  assert(approx(b.costSubtotal, 58500), `costSubtotal=${b.costSubtotal}`);
  assert(approx(b.paintingCost, 0), "floor paintingCost=0");
  assert(approx(b.margin, 11700), `margin=${b.margin}`);
  assert(approx(b.subtotalExclVat, 70200), `subtotalExclVat=${b.subtotalExclVat}`);
  assert(approx(b.vat, 3510), `vat=${b.vat}`);
  assert(approx(b.total, 73710), `total=${b.total}`);
  assert(approx(b.depositAmount + b.balanceAmount, b.total), "訂金+尾款=總計");
  assert(b.hasUnpriced === false, "全有報價 hasUnpriced=false");
}

// 2. 天花板:批土油漆 + perPing 拆除 + percent 雜項
{
  const b = computeEngineeringQuote({
    ...base,
    quoteType: "ceiling",
    paintingPerPing: 800,
    demolitionMode: "perPing",
    demolitionPerPing: 600,
    consumablesMode: "percent",
    consumablesPercent: 0.05,
  });
  assert(approx(b.paintingCost, 8000), `painting 800×10=${b.paintingCost}`);
  assert(approx(b.demolitionCost, 6000), `demolition 600×10=${b.demolitionCost}`);
  assert(approx(b.consumablesCost, 1500), `consumables 5%×materialCost(30000)=${b.consumablesCost}`);
}

// 3. floor 即使 paintingPerPing>0 也不算
{
  const b = computeEngineeringQuote({ ...base, quoteType: "floor", paintingPerPing: 800 });
  assert(approx(b.paintingCost, 0), "floor 強制 paintingCost=0");
}

// 4. 折扣
{
  const b = computeEngineeringQuote({ ...base, discountRate: 0.1 });
  assert(approx(b.discountAmount, 7020), `discount 10%×70200=${b.discountAmount}`);
  assert(approx(b.subtotalAfterDiscount, 63180), `afterDiscount=${b.subtotalAfterDiscount}`);
}

// 5. 未報價偵測:施工費 = 0
{
  const b = computeEngineeringQuote({ ...base, laborPricePerPing: 0 });
  assert(b.hasUnpriced === true, "施工費=0 → hasUnpriced=true");
}

// 5b. 未報價偵測:材料行有 unpriced
{
  const b = computeEngineeringQuote({
    ...base,
    materialLines: [{ label: "地板片", amount: 0, unpriced: true }],
  });
  assert(b.hasUnpriced === true, "材料行 unpriced → hasUnpriced=true");
}

// 6. computeValidUntil
{
  const d = computeValidUntil(30, new Date("2026-05-21T00:00:00+08:00"));
  assert(d === "2026-06-20", `validUntil=${d}`);
}

console.log(`✅ engineering-quote calc: ${passed} passed`);
