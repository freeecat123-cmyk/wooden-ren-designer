/**
 * 綠界 AioCheckOut 一次性付款 — 組參數、產生 auto-submit HTML、產生訂單編號
 *
 * 月付 / 年付目前都走「一次性扣款」+ 我們自己算 expires_at（30 / 365 天）。
 * 定期定額（PeriodAmount/PeriodType/Frequency/ExecTimes）等綠界後台開通後再加。
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
