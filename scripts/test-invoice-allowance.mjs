/**
 * 測試綠界 B2C 發票折讓 API (/B2CInvoice/Allowance)
 *
 * 用法：
 *   node --env-file=.env.local scripts/test-invoice-allowance.mjs <invoiceNumber> <invoiceDate> <amount> <email> [customerName]
 *
 * 範例：
 *   node --env-file=.env.local scripts/test-invoice-allowance.mjs YR12345678 2026-05-01 199 test@example.com
 *
 * 注意：
 *   - 這支會「真的」對綠界開折讓單,跑前確認 invoice 是真實存在的
 *   - prod 環境跑會影響真實發票!stage 環境才適合反覆測
 *   - 金額不能超過該發票剩餘可折讓額度
 */
import { createCipheriv, createDecipheriv } from "node:crypto";

const [, , invoiceNumber, invoiceDate, amountStr, email, customerName = ""] =
  process.argv;

if (!invoiceNumber || !invoiceDate || !amountStr || !email) {
  console.error("用法: node --env-file=.env.local scripts/test-invoice-allowance.mjs <invoiceNumber> <invoiceDate> <amount> <email> [customerName]");
  process.exit(1);
}

const amount = Number.parseInt(amountStr, 10);
if (!Number.isInteger(amount) || amount <= 0) {
  console.error("amount 必須是正整數");
  process.exit(1);
}

const HASH_KEY = process.env.ECPAY_INVOICE_HASH_KEY ?? process.env.INVOICE_HASH_KEY;
const HASH_IV = process.env.ECPAY_INVOICE_HASH_IV ?? process.env.INVOICE_HASH_IV;
const MERCHANT_ID =
  process.env.ECPAY_INVOICE_MERCHANT_ID ?? process.env.INVOICE_MERCHANT_ID;
const BASE_URL =
  process.env.ECPAY_INVOICE_BASE_URL ??
  process.env.INVOICE_BASE_URL ??
  "https://einvoice-stage.ecpay.com.tw"; // 預設 stage 防呆

if (!HASH_KEY || !HASH_IV || !MERCHANT_ID) {
  console.error("缺 env: ECPAY_INVOICE_HASH_KEY / ECPAY_INVOICE_HASH_IV / ECPAY_INVOICE_MERCHANT_ID");
  process.exit(1);
}

console.log("─".repeat(60));
console.log("環境：", BASE_URL.includes("stage") ? "🧪 STAGE 沙盒" : "🔴 PROD 正式");
console.log("商店：", MERCHANT_ID);
console.log("發票：", invoiceNumber, "@", invoiceDate);
console.log("金額：", amount, "NTD");
console.log("收件：", email);
console.log("買方：", customerName || "(空,個人戶)");
console.log("─".repeat(60));

function aesUrlEncode(s) {
  return encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7E")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}
function aesUrlDecode(s) {
  return decodeURIComponent(s.replace(/\+/g, "%20"));
}
function encrypt(data) {
  const key = Buffer.from(HASH_KEY, "utf8").subarray(0, 16);
  const iv = Buffer.from(HASH_IV, "utf8").subarray(0, 16);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([
    cipher.update(aesUrlEncode(JSON.stringify(data)), "utf8"),
    cipher.final(),
  ]).toString("base64");
}
function decrypt(b64) {
  const key = Buffer.from(HASH_KEY, "utf8").subarray(0, 16);
  const iv = Buffer.from(HASH_IV, "utf8").subarray(0, 16);
  const dec = createDecipheriv("aes-128-cbc", key, iv);
  const raw = Buffer.concat([
    dec.update(Buffer.from(b64, "base64")),
    dec.final(),
  ]).toString("utf8");
  return JSON.parse(aesUrlDecode(raw));
}

const innerData = {
  MerchantID: MERCHANT_ID,
  InvoiceNo: invoiceNumber,
  InvoiceDate: invoiceDate,
  AllowanceNotify: "E",
  CustomerName: customerName,
  NotifyMail: email,
  AllowanceAmount: amount,
  Items: [
    {
      ItemSeq: 1,
      ItemName: "木作藍圖訂閱退費折讓",
      ItemCount: 1,
      ItemWord: "次",
      ItemPrice: amount,
      ItemTaxType: "1",
      ItemAmount: amount,
    },
  ],
};

const envelope = {
  MerchantID: MERCHANT_ID,
  RqHeader: {
    Timestamp: Math.floor(Date.now() / 1000),
    Revision: "3.0.0",
  },
  Data: encrypt(innerData),
};

console.log("送出 inner data:");
console.log(JSON.stringify(innerData, null, 2));
console.log();

const res = await fetch(`${BASE_URL}/B2CInvoice/Allowance`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(envelope),
});

console.log("HTTP:", res.status, res.statusText);

const text = await res.text();
let envResp;
try {
  envResp = JSON.parse(text);
} catch {
  console.error("回應非 JSON：", text);
  process.exit(1);
}

console.log("外層 TransCode:", envResp.TransCode, "TransMsg:", envResp.TransMsg);
if (envResp.TransCode !== 1) {
  console.error("❌ 外層失敗（AES/格式錯誤）");
  process.exit(1);
}

const inner = decrypt(envResp.Data);
console.log();
console.log("─".repeat(60));
console.log("內層回應：");
console.log(JSON.stringify(inner, null, 2));
console.log("─".repeat(60));

if (inner.RtnCode === 1) {
  console.log("✅ 折讓開立成功");
  console.log("   IA_Allow_No        ：", inner.IA_Allow_No);
  console.log("   IA_Date            ：", inner.IA_Date);
  console.log("   IA_Remain_Allowance：", inner.IA_Remain_Allowance_Amt, "NTD（折讓後剩餘可折讓額）");
} else {
  console.error("❌ 折讓失敗：", inner.RtnCode, inner.RtnMsg);
  process.exit(1);
}
