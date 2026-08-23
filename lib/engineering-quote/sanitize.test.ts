import { describe, it, expect } from "vitest";
import { ENGINEERING_QUOTE_DEFAULTS as D, sanitizeEngQuoteOpts } from "./defaults";
import { computeEngineeringQuote } from "./calc";

/**
 * 列印頁的報價參數是從網址 `?o=` 解出來的，`decodeState` 只做 base64 + JSON.parse、
 * 零驗證。表單上的 NumField 有 `Math.max(0, …)`，但列印頁**完全繞過表單**。
 *
 * 而列印頁正是**要交到客戶手上**的那張單。2026-08-23 實測改網址就做得出：
 * 總價 −73,198、訂金比總價多 3 倍、整張 NaN。連結還是會分享出去的。
 */
describe("網址帶進來的報價參數要洗過", () => {
  it("正常值原封不動", () => {
    const o = sanitizeEngQuoteOpts({ ...D, marginRate: 0.25, discountRate: 0.1 });
    expect(o.marginRate).toBe(0.25);
    expect(o.discountRate).toBe(0.1);
  });

  it("折扣 500% → 夾成 50%", () => expect(sanitizeEngQuoteOpts({ discountRate: 5 }).discountRate).toBe(0.5));
  it("毛利 −100% → 夾成 0", () => expect(sanitizeEngQuoteOpts({ marginRate: -1 }).marginRate).toBe(0));
  it("稅率 −50% → 夾成 0", () => expect(sanitizeEngQuoteOpts({ vatRate: -0.5 }).vatRate).toBe(0));
  it("訂金 300% → 夾成 100%（不可能收超過總價）", () =>
    expect(sanitizeEngQuoteOpts({ depositRate: 3 }).depositRate).toBe(1));

  it("填文字 / null / NaN → 退回預設值，不是變成 NaN", () => {
    expect(sanitizeEngQuoteOpts({ marginRate: "abc" }).marginRate).toBe(D.marginRate);
    expect(sanitizeEngQuoteOpts({ laborPricePerPing: null }).laborPricePerPing).toBe(D.laborPricePerPing);
    expect(sanitizeEngQuoteOpts({ vatRate: NaN }).vatRate).toBe(D.vatRate);
  });

  it("金額欄位不收負數", () => {
    const o = sanitizeEngQuoteOpts({ shippingCost: -9999, demolitionLump: -500 });
    expect(o.shippingCost).toBe(0);
    expect(o.demolitionLump).toBe(0);
  });

  it("網址塞不認得的欄位 → 直接無視，不會污染", () => {
    const o = sanitizeEngQuoteOpts({ __evil: 999, marginRate: 0.3 }) as any;
    expect(o.__evil).toBeUndefined();
    expect(o.marginRate).toBe(0.3);
  });

  it("完全是垃圾（字串 / null / 陣列）→ 整包退回預設值", () => {
    for (const junk of ["x", null, undefined, [], 42]) {
      expect(sanitizeEngQuoteOpts(junk)).toEqual(D);
    }
  });
});

describe("洗過之後，客戶拿到的那張單不會出現離譜數字", () => {
  const base: any = {
    quoteType: "ceiling", pingShu: 10, areaM2: 33.05,
    materialCost: 50000, materialLines: [{ label: "料", amount: 50000 }],
    laborPricePerPing: 3000,
  };
  const tampered = [
    { discountRate: 5 }, { marginRate: -1 }, { vatRate: -0.5 }, { depositRate: 3 },
    { marginRate: "abc" }, { laborPricePerPing: null }, { consumablesPercent: 100 },
  ];

  for (const t of tampered) {
    it(`被改成 ${JSON.stringify(t)} 之後仍然是一張合理的單`, () => {
      const q = computeEngineeringQuote({ ...base, ...sanitizeEngQuoteOpts({ ...D, ...base, ...t }) });
      for (const [k, v] of Object.entries(q)) {
        if (typeof v !== "number") continue;
        expect(Number.isFinite(v), `${k} = ${v}`).toBe(true);
        expect(v, `${k} 不該是負的`).toBeGreaterThanOrEqual(0);
      }
      expect(q.depositAmount).toBeLessThanOrEqual(q.total);
      expect(q.depositAmount + q.balanceAmount).toBe(q.total);
    });
  }
});
