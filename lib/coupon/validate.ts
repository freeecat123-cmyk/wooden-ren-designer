/**
 * Coupon 驗證：給 /api/checkout 跟 /api/coupon/validate 共用。
 *
 * 規則：
 *   - 必須是該 user 本人的 coupon（survey_coupons.user_id = user.id）
 *   - used = false
 *   - expires_at > now
 *   - 只能用年付（ECPay 定期定額 PeriodAmount == TotalAmount 限制,
 *     月付沒辦法只折首期）
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CouponInfo {
  code: string;
  discountPercent: number;
  expiresAt: string;
}

export interface CouponValidationOk {
  ok: true;
  coupon: CouponInfo;
  discountedAmount: number;
  savedAmount: number;
}
export interface CouponValidationErr {
  ok: false;
  error: string;
}
export type CouponValidationResult = CouponValidationOk | CouponValidationErr;

export async function validateCoupon(opts: {
  admin: SupabaseClient;
  userId: string;
  code: string;
  period: "monthly" | "yearly";
  originalAmount: number;
}): Promise<CouponValidationResult> {
  const code = opts.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "未輸入 coupon code" };

  if (opts.period !== "yearly") {
    return {
      ok: false,
      error: "coupon 只能用在年付方案（月付定期定額限制）",
    };
  }

  const { data: coupon, error } = await opts.admin
    .from("survey_coupons")
    .select("code, user_id, discount_percent, expires_at, used")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    return { ok: false, error: "查詢 coupon 失敗" };
  }
  if (!coupon) {
    return { ok: false, error: "查無此 coupon code" };
  }
  if (coupon.user_id !== opts.userId) {
    return { ok: false, error: "這張 coupon 不是你的" };
  }
  if (coupon.used) {
    return { ok: false, error: "這張 coupon 已經用過" };
  }
  if (new Date(coupon.expires_at) <= new Date()) {
    return { ok: false, error: "這張 coupon 已過期" };
  }

  const pct = coupon.discount_percent as number;
  const discountedAmount = Math.max(
    1,
    Math.round((opts.originalAmount * (100 - pct)) / 100),
  );
  const savedAmount = opts.originalAmount - discountedAmount;

  return {
    ok: true,
    coupon: {
      code: coupon.code as string,
      discountPercent: pct,
      expiresAt: coupon.expires_at as string,
    },
    discountedAmount,
    savedAmount,
  };
}
