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

/** 後端組 callback URL 用的網域 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
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
