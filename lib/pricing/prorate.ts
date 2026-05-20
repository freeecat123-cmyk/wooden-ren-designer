/**
 * 升級訂閱時 prorate 退費計算。
 *
 * 邏輯:user 現在的訂閱還剩 N 天沒用,把未使用部分按比例退原卡。
 * 公式:refund = min(paidAmount, paidAmount × remainingDays / totalDays)
 *
 * 上限 paidAmount = 防止 expires_at 比正常週期長導致退超過原本付的(倒賺)。
 *
 * 共用於:
 * - PricingPlanCard 升級按鈕顯示「退舊版 NT$X」
 * - ECPay return webhook 確認 pro 成功後實際呼叫退費
 */

import type { BillingPeriod } from "./plans";

export function periodDays(period: BillingPeriod): number {
  // monthly=31 對齊 webhook 設 expires_at = +31 天的邏輯(commit a5c2262 刻意送一天)。
  // 不對齊會造成「付完 24h 內升級永遠全退」:
  //   raw = paidAmount × 31 / 30 > paidAmount → min() clip 回 paidAmount → 全退
  return period === "yearly" ? 365 : 31;
}

export interface ProrateInput {
  /** 原本付了多少 (NT$,整數) */
  paidAmount: number;
  /** 訂閱計費週期 */
  period: BillingPeriod;
  /** 訂閱到期日 ISO,計算剩餘天數用 */
  expiresAt: string | Date | null | undefined;
  /** 算到哪一天 (預設 now),測試用 */
  asOf?: Date;
}

export interface ProrateResult {
  /** 升級時要退回原卡的金額 (NT$) */
  refundAmount: number;
  /** 剩餘天數(0 if expires_at 過期或缺) */
  remainingDays: number;
  /** 一個 billing period 的標準天數 (30 / 365) */
  totalDays: number;
}

export function calcProrateRefund(input: ProrateInput): ProrateResult {
  const totalDays = periodDays(input.period);
  if (!input.expiresAt || input.paidAmount <= 0) {
    return { refundAmount: 0, remainingDays: 0, totalDays };
  }
  const exp = typeof input.expiresAt === "string" ? new Date(input.expiresAt) : input.expiresAt;
  const now = input.asOf ?? new Date();
  const ms = exp.getTime() - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) {
    return { refundAmount: 0, remainingDays: 0, totalDays };
  }
  const remainingDays = Math.floor(ms / 86400000);
  const raw = Math.floor((input.paidAmount * remainingDays) / totalDays);
  const refundAmount = Math.max(0, Math.min(input.paidAmount, raw));
  return { refundAmount, remainingDays, totalDays };
}
