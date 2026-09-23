/**
 * 綠界 ECPay 設定 — 環境變數讀取 + sandbox / production URL 切換
 * 所有對外打綠界的 module 都從這裡拿 endpoint 與憑證。
 */

export type EcpayEnv = "sandbox" | "production";

export const ECPAY_ENV: EcpayEnv =
  (process.env.ECPAY_ENV as EcpayEnv) === "production" ? "production" : "sandbox";

export const ECPAY_MERCHANT_ID = process.env.ECPAY_MERCHANT_ID ?? "";
export const ECPAY_HASH_KEY = process.env.ECPAY_HASH_KEY ?? "";
export const ECPAY_HASH_IV = process.env.ECPAY_HASH_IV ?? "";

export const ECPAY_AIO_URL =
  ECPAY_ENV === "production"
    ? "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5"
    : "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

/** 信用卡定期定額終止/查詢的 Action URL */
export const ECPAY_CREDIT_PERIOD_ACTION_URL =
  ECPAY_ENV === "production"
    ? "https://payment.ecpay.com.tw/Cashier/CreditCardPeriodAction"
    : "https://payment-stage.ecpay.com.tw/Cashier/CreditCardPeriodAction";

/** 信用卡單筆操作（請款 C / 退款 R / 取消 E / 放棄 N）— 用於 admin 退款 */
export const ECPAY_CREDIT_DETAIL_DOACTION_URL =
  ECPAY_ENV === "production"
    ? "https://payment.ecpay.com.tw/CreditDetail/DoAction"
    : "https://payment-stage.ecpay.com.tw/CreditDetail/DoAction";

/**
 * 後端組 callback URL 用的網域
 *
 * production 環境一定要明確設 NEXT_PUBLIC_SITE_URL（= https://designer.woodenren.com），
 * 不能 fallback 到 VERCEL_URL — preview alias 會跟著每次 deploy 變動，
 * 一旦變動，綠界記在使用者卡片上的 PeriodReturnURL 就會打到舊的 alias，
 * 第 2 期之後月扣 webhook 全部噴 404，使用者被扣款但服務沒延期。
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (ECPAY_ENV === "production") {
    throw new Error(
      "[ecpay] production 環境必須設定 NEXT_PUBLIC_SITE_URL（例：https://designer.woodenren.com），不可 fallback 到 VERCEL_URL",
    );
  }
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function assertEcpayConfigured(): void {
  if (!ECPAY_MERCHANT_ID || !ECPAY_HASH_KEY || !ECPAY_HASH_IV) {
    throw new Error(
      "ECPay 環境變數未設定。請在 .env.local（或 Vercel Project Settings）填入 ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV",
    );
  }
}
