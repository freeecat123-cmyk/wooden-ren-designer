// 診斷:對 NT$890 payment 2605201013284759 打綠界 N/E/R 看 raw 回應
// 用法: node --use-system-ca --env-file=.env.local scripts/probe-refund-890.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TARGET_TRADE_NO = "2605201013284759";
const ENV = process.env.ECPAY_ENV ?? "production";
const URL =
  ENV === "production"
    ? "https://payment.ecpay.com.tw/CreditDetail/DoAction"
    : "https://payment-stage.ecpay.com.tw/CreditDetail/DoAction";

const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;

function urlEncodeEcpay(s) {
  return encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7e")
    .replace(/'/g, "%27")
    .toLowerCase();
}
function cmv(params) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== "CheckMacValue" && v != null)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
  let raw = `HashKey=${HASH_KEY}`;
  for (const [k, v] of entries) raw += `&${k}=${v}`;
  raw += `&HashIV=${HASH_IV}`;
  return createHash("sha256").update(urlEncodeEcpay(raw)).digest("hex").toUpperCase();
}

// 撈 payment 拿 MerchantTradeNo
const { data: p } = await sb
  .from("payments")
  .select("id, amount, ecpay_trade_no, raw_response, status")
  .eq("ecpay_trade_no", TARGET_TRADE_NO)
  .single();

if (!p) {
  console.error("找不到 payment:", TARGET_TRADE_NO);
  process.exit(1);
}
console.log("Payment:", {
  id: p.id,
  amount: p.amount,
  status: p.status,
  tradeNo: p.ecpay_trade_no,
});
const merchantTradeNo = p.raw_response?.MerchantTradeNo;
console.log("MerchantTradeNo from raw:", merchantTradeNo);

if (!merchantTradeNo) {
  console.error("raw_response 沒 MerchantTradeNo");
  console.log("raw_response keys:", Object.keys(p.raw_response ?? {}));
  process.exit(1);
}

console.log(`\nENV=${ENV} URL=${URL}\n`);

for (const action of ["N", "E", "R"]) {
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TradeNo: TARGET_TRADE_NO,
    Action: action,
    TotalAmount: String(p.amount),
  };
  params.CheckMacValue = cmv(params);

  const body = new URLSearchParams(params).toString();
  console.log(`--- Action=${action} ---`);
  console.log("body:", body.replace(HASH_KEY, "<KEY>").replace(HASH_IV, "<IV>"));
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    console.log("HTTP:", res.status, res.statusText);
    console.log("headers content-type:", res.headers.get("content-type"));
    const text = await res.text();
    console.log("raw body:", JSON.stringify(text));
    console.log("length:", text.length);
  } catch (e) {
    console.error("fetch error:", e.message);
  }
  console.log();
}
