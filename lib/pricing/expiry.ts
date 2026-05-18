/**
 * 訂閱到期 / grace period 邏輯。
 *
 * 業界慣例：到期後給 1~7 天 grace period，銀行扣款失敗常見原因（卡片快到期、
 * 額度不足、銀行暫時 reject 都會被綠界自動重試 1-3 次）。grace period 內仍
 * 維持付費權限、不立刻降回 free，避免用戶因綠界一次扣款失敗體驗中斷。
 *
 * 3 天是 SaaS 訂閱常見默認（Stripe 預設 dunning period 3 天）。
 */

export const GRACE_PERIOD_DAYS = 3;
export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 86_400_000;

/**
 * 訂閱已到期且過了 grace period（可以 downgrade 回 free）。
 */
export function isExpiredPastGrace(
  expiresAt: string | Date | null,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const exp = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return exp.getTime() + GRACE_PERIOD_MS < now.getTime();
}

/**
 * 訂閱在 grace period 內（已過 expires_at、未過 grace 上限）。
 * 用來顯示警告 banner「訂閱已到期，請於 X 天內續訂以維持服務」。
 */
export function isInGracePeriod(
  expiresAt: string | Date | null,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const exp = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const t = exp.getTime();
  return t < now.getTime() && t + GRACE_PERIOD_MS >= now.getTime();
}

/**
 * 訂閱即將到期（離 expires_at < N 天，給 reminder banner 用）。
 */
export function isExpiringSoon(
  expiresAt: string | Date | null,
  daysAhead = 7,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const exp = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const t = exp.getTime();
  return t > now.getTime() && t < now.getTime() + daysAhead * 86_400_000;
}
