// 查綠界對 WRMPDFGT1EFVHR (NT$890) 還記得什麼狀態
import { createHash } from "node:crypto";

const ENV = process.env.ECPAY_ENV ?? "production";
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const URL =
  ENV === "production"
    ? "https://payment.ecpay.com.tw/Cashier/QueryCreditCardPeriodInfo"
    : "https://payment-stage.ecpay.com.tw/Cashier/QueryCreditCardPeriodInfo";

function urlEncodeEcpay(s) {
  return encodeURIComponent(s).replace(/%20/g, "+").replace(/~/g, "%7e").replace(/'/g, "%27").toLowerCase();
}
function cmv(p) {
  const entries = Object.entries(p)
    .filter(([k, v]) => k !== "CheckMacValue" && v != null)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
  let raw = `HashKey=${HASH_KEY}`;
  for (const [k, v] of entries) raw += `&${k}=${v}`;
  raw += `&HashIV=${HASH_IV}`;
  return createHash("sha256").update(urlEncodeEcpay(raw)).digest("hex").toUpperCase();
}

for (const mtNo of ["WRMPDFGT1EFVHR", "WRMPDE1T9LO17S"]) {
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: mtNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = cmv(params);
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  console.log(`\n=== ${mtNo} ===`);
  console.log("HTTP:", res.status);
  console.log("raw:", text.slice(0, 500));
  try {
    const j = JSON.parse(text);
    console.log("ExecStatus:", j.ExecStatus, "TotalSuccessTimes:", j.TotalSuccessTimes, "TotalSuccessAmount:", j.TotalSuccessAmount);
  } catch {}
}
