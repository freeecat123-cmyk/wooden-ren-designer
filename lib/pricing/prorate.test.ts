import { describe, it, expect } from "vitest";
import { calcProrateRefund, inferBillingPeriod, periodDays } from "./prorate";

/**
 * 🧷 升級時的按比例退款。
 *
 * ⭐ 為什麼非測不可:這支決定**實際退回客戶信用卡的金額**
 *   (ECPay return webhook 的 refundOldSubProrate 直接拿它的結果去打綠界退款 API)。
 *   在此之前**零測試**。(2026-08-21 稽核發現。)
 */
const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const NOW = new Date();

describe("calcProrateRefund", () => {
  it("① 還剩一半 → 退一半", () => {
    const r = calcProrateRefund({ paidAmount: 3650, period: "yearly", expiresAt: at(182), asOf: NOW });
    expect(r.totalDays).toBe(365);
    expect(r.remainingDays).toBe(182);
    expect(r.refundAmount).toBe(Math.floor((3650 * 182) / 365));
  });

  it("② 已經過期 → 不退", () => {
    expect(calcProrateRefund({ paidAmount: 3650, period: "yearly", expiresAt: at(-1), asOf: NOW }).refundAmount).toBe(0);
  });

  it("③ 沒有到期日 → 不退（不能因為資料缺就整筆退回）", () => {
    expect(calcProrateRefund({ paidAmount: 3650, period: "yearly", expiresAt: null, asOf: NOW }).refundAmount).toBe(0);
    expect(calcProrateRefund({ paidAmount: 3650, period: "yearly", expiresAt: "壞掉的日期", asOf: NOW }).refundAmount).toBe(0);
  });

  it("④ ⛔退款金額永遠不超過他付過的錢（到期日異常長也不能倒賺）", () => {
    const r = calcProrateRefund({ paidAmount: 390, period: "monthly", expiresAt: at(9999), asOf: NOW });
    expect(r.refundAmount).toBe(390);
  });

  it("⑤ 月繳基準是 31 天不是 30（對齊 webhook 設到期日 +31 天）", () => {
    expect(periodDays("monthly")).toBe(31);
    // 若改成 30,付完隔天升級會變成 raw > paidAmount → 夾成全退
    const r = calcProrateRefund({ paidAmount: 390, period: "monthly", expiresAt: at(30), asOf: NOW });
    expect(r.refundAmount).toBeLessThan(390);
  });

  it("⑥ 金額 0 或負 → 不退", () => {
    expect(calcProrateRefund({ paidAmount: 0, period: "yearly", expiresAt: at(300), asOf: NOW }).refundAmount).toBe(0);
  });
});

describe("inferBillingPeriod — 舊資料的 period 是 NULL", () => {
  /**
   * ⭐ 這組就是稽核抓到的真實情境:`subscriptions.period` 是 2026-05-19 才加的欄位,
   *   那天以前建立的年繳訂閱都是 NULL。呼叫端原本 `?? "monthly"` 把它們當月繳,
   *   用 31 天當基準 → 算出來遠超過已付金額 → 被夾成**全額退款**。
   *   正式站實查:目前有 2 筆 period 為 NULL 且仍 active、跨度 365 天的訂閱。
   */
  it("⑦ period 有值就直接用", () => {
    expect(inferBillingPeriod({ period: "yearly" })).toBe("yearly");
    expect(inferBillingPeriod({ period: "monthly" })).toBe("monthly");
  });

  it("⑧ ⭐period 為 NULL、但實際跨 365 天 → 判定年繳", () => {
    expect(
      inferBillingPeriod({ period: null, started_at: "2026-05-18T00:00:00Z", expires_at: "2027-05-18T00:00:00Z" }),
    ).toBe("yearly");
  });

  it("⑨ period 為 NULL、跨 31 天 → 判定月繳", () => {
    expect(
      inferBillingPeriod({ period: null, started_at: "2026-05-18T00:00:00Z", expires_at: "2026-06-18T00:00:00Z" }),
    ).toBe("monthly");
  });

  it("⑩ 日期缺一個 → 保守退回月繳（寧可少退也不要多退）", () => {
    expect(inferBillingPeriod({ period: null, started_at: null, expires_at: "2027-05-18T00:00:00Z" })).toBe("monthly");
    expect(inferBillingPeriod({ period: null, started_at: "2026-05-18T00:00:00Z", expires_at: null })).toBe("monthly");
  });

  it("⑪ ⛔整合驗證:舊年繳戶（period NULL）剩 300 天,不可以退成全額", () => {
    const oldSub = { period: null, started_at: "2026-05-18T00:00:00Z", expires_at: at(300) };
    const wrong = calcProrateRefund({ paidAmount: 3588, period: "monthly", expiresAt: oldSub.expires_at, asOf: NOW });
    const right = calcProrateRefund({ paidAmount: 3588, period: inferBillingPeriod(oldSub), expiresAt: oldSub.expires_at, asOf: NOW });
    expect(wrong.refundAmount).toBe(3588); // 舊行為:全額退款
    expect(right.refundAmount).toBe(Math.floor((3588 * 300) / 365)); // 正確:只退未使用的部分
    expect(right.refundAmount).toBeLessThan(wrong.refundAmount);
  });
});
