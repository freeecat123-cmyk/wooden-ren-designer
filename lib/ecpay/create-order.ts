/**
 * 綠界 AioCheckOut 訂單組裝
 *
 * 月付 → 走信用卡定期定額（PeriodAmount/PeriodType=M/Frequency=1/ExecTimes=99）
 * 年付 → 走一次性付款（一年扣一次）
 *
 * 兩種都用同一個 AioCheckOut endpoint，差別在 ChoosePayment + 是否帶 Period* 欄位。
 */
import { calculateCheckMacValue } from "./check-mac-value";
import {
  ECPAY_AIO_URL,
  ECPAY_HASH_IV,
  ECPAY_HASH_KEY,
  ECPAY_MERCHANT_ID,
  getBaseUrl,
} from "./config";

export interface OneTimeOrderInput {
  orderId: string;
  amount: number;
  itemName: string;
  description: string;
  email?: string;
}

/** 綠界 MerchantTradeNo 上限 20 字、僅英數 */
export function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase(); // 8~9 chars
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `WR${ts}${rand}`.slice(0, 20);
}

function formatTradeDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // ECPay 要 yyyy/MM/dd HH:mm:ss
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function buildAioParams(input: OneTimeOrderInput): Record<string, string> {
  const baseUrl = getBaseUrl();
  const params: Record<string, string> = {
    MerchantID: ECPAY_MERCHANT_ID,
    MerchantTradeNo: input.orderId,
    MerchantTradeDate: formatTradeDate(new Date()),
    PaymentType: "aio",
    TotalAmount: String(input.amount),
    TradeDesc: input.description.slice(0, 200),
    ItemName: input.itemName.slice(0, 200),
    ReturnURL: `${baseUrl}/api/ecpay/return`,
    ClientBackURL: `${baseUrl}/my-subscription?paid=1`,
    ChoosePayment: "ALL",
    EncryptType: "1",
  };
  if (input.email) params.Email = input.email;

  params.CheckMacValue = calculateCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV);
  return params;
}

/**
 * 信用卡定期定額（月扣）參數
 *
 * 限制：
 *  - 只能用信用卡（ChoosePayment=Credit）
 *  - PeriodAmount 必須跟 TotalAmount 相同（首期 = 每期金額）
 *  - 同張卡 / 同商店 / 同金額不可同時存在多筆未終止的定期定額（重複會被綠界擋）
 *  - 月扣金額限 NT$5 ~ NT$99,999
 */
export interface PeriodicOrderInput extends OneTimeOrderInput {
  /** 每期扣款金額（NTD） */
  periodAmount: number;
}

export function buildPeriodicParams(input: PeriodicOrderInput): Record<string, string> {
  const baseUrl = getBaseUrl();
  const params: Record<string, string> = {
    MerchantID: ECPAY_MERCHANT_ID,
    MerchantTradeNo: input.orderId,
    MerchantTradeDate: formatTradeDate(new Date()),
    PaymentType: "aio",
    TotalAmount: String(input.amount),
    TradeDesc: input.description.slice(0, 200),
    ItemName: input.itemName.slice(0, 200),
    ReturnURL: `${baseUrl}/api/ecpay/return`,
    ClientBackURL: `${baseUrl}/my-subscription?paid=1`,
    ChoosePayment: "Credit",
    EncryptType: "1",

    // 定期定額專屬欄位
    PeriodAmount: String(input.periodAmount),
    PeriodType: "M",
    Frequency: "1",
    ExecTimes: "99",
    PeriodReturnURL: `${baseUrl}/api/ecpay/periodic-notify`,
  };
  if (input.email) params.Email = input.email;

  params.CheckMacValue = calculateCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV);
  return params;
}

/**
 * 終止信用卡定期定額（綠界 CreditCardPeriodAction Action=Cancel）
 *
 * ⚠️ 綠界 API 規格陷阱：
 *   - Action 是 "Cancel" 不是 "Terminate"（"Terminate" 是綠界後台的中文「終止」UI label，
 *     對應到 API 實際接受的 Action 值是 "Cancel"）
 *   - 必填 TimeStamp（unix 秒），不是 TotalAmount
 *   - 2026-05-19 試刷 WRMPC7413XD3NV 時舊版送 Terminate+TotalAmount=0 被綠界靜默拒絕
 *     （RtnCode=10100140 + MerchantID/MerchantTradeNo 回空字串，代表 request 沒被解析）
 *
 * 來源：~/.claude/skills/ecpay/guides/01-payment-aio.md §定期定額管理
 */
export function buildPeriodicTerminateParams(
  merchantTradeNo: string,
): Record<string, string> {
  const params: Record<string, string> = {
    MerchantID: ECPAY_MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    Action: "Cancel",
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = calculateCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV);
  return params;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAutoSubmitHtml(
  action: string,
  params: Record<string, string>,
): string {
  const inputs = Object.entries(params)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`,
    )
    .join("\n  ");
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <title>導向綠界付款中…</title>
  <style>
    body{font-family:-apple-system,"Microsoft JhengHei",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#5a3812;background:#fff8ee;margin:0}
    .box{text-align:center}
    .spinner{display:inline-block;width:32px;height:32px;border:3px solid #d4a574;border-top-color:transparent;border-radius:50%;animation:s 0.8s linear infinite;margin-bottom:12px}
    @keyframes s{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <p>正在導向綠界付款頁，請稍候…</p>
    <form id="ecpay-form" method="POST" action="${escapeHtml(action)}">
  ${inputs}
    </form>
    <noscript><button form="ecpay-form" type="submit">前往綠界付款</button></noscript>
    <script>document.getElementById('ecpay-form').submit();</script>
  </div>
</body>
</html>`;
}

export function getAioUrl(): string {
  return ECPAY_AIO_URL;
}
