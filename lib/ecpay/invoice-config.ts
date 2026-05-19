/**
 * 綠界 B2C 電子發票設定 — 與金流帳號完全獨立，須另一組 MID/HashKey/HashIV
 *
 * 為什麼分開：綠界發票是另一個產品線，廠商後台的發票區塊有獨立的 MerchantID
 * 跟 HashKey/HashIV。即使金流跟發票申請同一公司戶，三組憑證也不同。
 *
 * sandbox 預設用綠界公開測試帳號 2000132（所有開發者共用，僅供整合驗證）。
 */

export type InvoiceEnv = "sandbox" | "production";

export const INVOICE_ENV: InvoiceEnv =
  (process.env.ECPAY_INVOICE_ENV as InvoiceEnv) === "production"
    ? "production"
    : "sandbox";

// sandbox 預設用綠界官方公開測試帳號，方便整合期不必等正式帳號就能驗收
const SANDBOX_DEFAULTS = {
  merchantId: "2000132",
  hashKey: "ejCk326UnaZWKisg",
  hashIv: "q9jcZX8Ib9LM8wYk",
};

export const INVOICE_MERCHANT_ID =
  process.env.ECPAY_INVOICE_MERCHANT_ID ??
  (INVOICE_ENV === "sandbox" ? SANDBOX_DEFAULTS.merchantId : "");

export const INVOICE_HASH_KEY =
  process.env.ECPAY_INVOICE_HASH_KEY ??
  (INVOICE_ENV === "sandbox" ? SANDBOX_DEFAULTS.hashKey : "");

export const INVOICE_HASH_IV =
  process.env.ECPAY_INVOICE_HASH_IV ??
  (INVOICE_ENV === "sandbox" ? SANDBOX_DEFAULTS.hashIv : "");

export const INVOICE_BASE_URL =
  INVOICE_ENV === "production"
    ? "https://einvoice.ecpay.com.tw"
    : "https://einvoice-stage.ecpay.com.tw";

export function assertInvoiceConfigured(): void {
  if (!INVOICE_MERCHANT_ID || !INVOICE_HASH_KEY || !INVOICE_HASH_IV) {
    throw new Error(
      "[ecpay-invoice] 電子發票環境變數未設定。production 必須設 ECPAY_INVOICE_MERCHANT_ID / ECPAY_INVOICE_HASH_KEY / ECPAY_INVOICE_HASH_IV（發票帳號與金流帳號不同，需在綠界後台另查）",
    );
  }
}

export type InvoicePreference = {
  type?: "personal" | "company";
  /** 公司統一編號（8 碼數字），type=company 必填 */
  taxId?: string;
  /** 公司抬頭，type=company 必填 */
  title?: string;
  /** 載具類型：mobile=手機條碼 / member=綠界會員載具 */
  carrierType?: "mobile" | "member";
  /** 手機條碼（8 碼，格式 /XXX+XXX），carrierType=mobile 必填 */
  carrierNum?: string;
  /** 發票寄件信箱；缺省用 user.email */
  email?: string;
};
