import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

/**
 * Constant-time string equality.
 *
 * 比 `a === b` 安全 — 一般字串比較會 short-circuit 在第一個不同 byte,
 * 攻擊者用 timing 量測就能逐 byte 試出密鑰。`crypto.timingSafeEqual`
 * 一定走完整個 buffer。
 *
 * 兩字串長度不同時直接回 false(不暴露長度差,但本身長度差時 timing 不可避免)。
 *
 * 用在驗證 CRON_SECRET / API key / webhook signature 等所有從外部來的 secret 比對。
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  // 長度不同時直接 false。crypto.timingSafeEqual 會 throw,先擋下。
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // 同樣 utf8 編碼長度可能不一致(multi-byte char),再防一次
  if (bufA.length !== bufB.length) return false;
  return nodeTimingSafeEqual(bufA, bufB);
}
