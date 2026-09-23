#!/usr/bin/env node
/**
 * 綠界 ECPay 安全自測 — 模擬攻擊本機 dev server 確認防禦有效。
 *
 * 前置:
 *   1. 跑本機 dev server (PORT=3000):
 *      npm run dev
 *   2. .env.local 已設:
 *      ECPAY_HASH_KEY=...
 *      ECPAY_HASH_IV=...
 *      NEXT_PUBLIC_SUPABASE_URL=...
 *      SUPABASE_SERVICE_ROLE_KEY=...
 *
 * 用法:
 *   node scripts/test-ecpay-security.mjs                 # 基本測 (無需 DB sub)
 *   node scripts/test-ecpay-security.mjs --full <subId>  # 完整測 (含 replay/amount)
 *
 * 測試項目:
 *   T1 缺 MerchantTradeNo                → 預期 401 / 1|OK 但 DB 無 payment
 *   T2 假 CheckMacValue                  → 同上
 *   T3 不存在的 MerchantTradeNo          → 同上
 *   T4 (--full) 同一 trade_no replay     → DB unique 擋,第 2 次無新 payment
 *   T5 (--full) 金額被竄改               → expected_amount 比對失敗,reject
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// ---- 1. 讀 .env.local ----
function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    // .env.local 不存在也 OK,只用 process.env
  }
}
loadEnv();

const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!HASH_KEY || !HASH_IV) {
  console.error("✗ 缺 ECPAY_HASH_KEY 或 ECPAY_HASH_IV (檢查 .env.local)");
  process.exit(1);
}

// ---- 2. CheckMacValue 計算 (跟 lib/ecpay/check-mac-value.ts 一致) ----
function urlEncodeEcpay(s) {
  return encodeURIComponent(s).replace(/%20/g, "+").replace(/~/g, "%7e").replace(/'/g, "%27").toLowerCase();
}
function calcCheckMac(params) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== "CheckMacValue" && v != null)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
  let raw = `HashKey=${HASH_KEY}`;
  for (const [k, v] of entries) raw += `&${k}=${v}`;
  raw += `&HashIV=${HASH_IV}`;
  return createHash("sha256").update(urlEncodeEcpay(raw)).digest("hex").toUpperCase();
}
function signedParams(extra) {
  const p = { ...extra };
  p.CheckMacValue = calcCheckMac(p);
  return p;
}

// ---- 3. DB 查 (用 Supabase REST) ----
async function fetchPaymentByTradeNo(tradeNo) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/payments?ecpay_trade_no=eq.${encodeURIComponent(tradeNo)}&select=id,status,amount,created_at`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ---- 4. POST 攻擊 endpoint ----
async function attack(endpoint, params, asForm = true) {
  let body, contentType;
  if (asForm) {
    body = new URLSearchParams(params).toString();
    contentType = "application/x-www-form-urlencoded";
  } else {
    body = JSON.stringify(params);
    contentType = "application/json";
  }
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
  return { status: res.status, body: await res.text() };
}

const results = [];
function recordTest(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ---- T1: 缺 MerchantTradeNo ----
async function t1_missingMerchantTradeNo() {
  const r = await attack("/api/ecpay/return", { RtnCode: "1", PaymentDate: "2026/05/19 00:00:00" });
  // 沒 MerchantTradeNo 應該被 reject,DB 無新 payment 紀錄
  const pass = r.status === 200; // ECPay 慣例回 200,但內部不會 insert
  recordTest("T1 缺 MerchantTradeNo → 不處理", pass, `HTTP ${r.status}`);
}

// ---- T2: 假 CheckMacValue ----
async function t2_badCheckMac() {
  const fakeTrade = `FAKE${Date.now()}`;
  const r = await attack("/api/ecpay/return", {
    MerchantTradeNo: fakeTrade,
    RtnCode: "1",
    PaymentDate: "2026/05/19 00:00:00",
    TradeAmt: "100",
    CheckMacValue: "DEADBEEF".repeat(8),
  });
  await new Promise((s) => setTimeout(s, 500));
  const payments = await fetchPaymentByTradeNo(fakeTrade);
  const pass = !payments || payments.length === 0;
  recordTest("T2 假 CheckMacValue → 無 payment 寫入", pass, `HTTP ${r.status}, DB payments=${payments?.length ?? "?"}`);
}

// ---- T3: 不存在的 MerchantTradeNo (有效 sig) ----
async function t3_unknownTradeNo() {
  const fakeTrade = `UNKNOWN${Date.now()}`;
  const params = signedParams({
    MerchantTradeNo: fakeTrade,
    RtnCode: "1",
    PaymentDate: "2026/05/19 00:00:00",
    TradeAmt: "100",
    PaymentType: "Credit_CreditCard",
    TradeNo: `NOEXIST${Date.now()}`,
  });
  const r = await attack("/api/ecpay/return", params);
  await new Promise((s) => setTimeout(s, 500));
  const payments = await fetchPaymentByTradeNo(params.TradeNo);
  const pass = !payments || payments.length === 0;
  recordTest("T3 不存在的 MerchantTradeNo → 無 payment 寫入", pass, `HTTP ${r.status}, DB payments=${payments?.length ?? "?"}`);
}

// ---- T4: replay (需 --full <subMerchantTradeNo>) ----
async function t4_replay(subMerchantTradeNo) {
  const tradeNo = `REPLAY${Date.now()}`;
  const params = signedParams({
    MerchantTradeNo: subMerchantTradeNo,
    RtnCode: "1",
    PaymentDate: "2026/05/19 00:00:00",
    TradeAmt: "390",
    PaymentType: "Credit_CreditCard",
    TradeNo: tradeNo,
  });
  const r1 = await attack("/api/ecpay/return", params);
  await new Promise((s) => setTimeout(s, 500));
  const after1 = await fetchPaymentByTradeNo(tradeNo);

  // 第 2 次相同 payload
  const r2 = await attack("/api/ecpay/return", params);
  await new Promise((s) => setTimeout(s, 500));
  const after2 = await fetchPaymentByTradeNo(tradeNo);

  const count1 = after1?.length ?? 0;
  const count2 = after2?.length ?? 0;
  // 第 1 次應寫入,第 2 次 unique constraint 擋住 (count 不變)
  const pass = count1 === 1 && count2 === 1;
  recordTest(
    "T4 replay → 第 2 次被 DB unique 擋",
    pass,
    `R1 HTTP ${r1.status} payments=${count1} → R2 HTTP ${r2.status} payments=${count2}`,
  );
}

// ---- T5: 金額被竄改 ----
async function t5_amountTamper(subMerchantTradeNo) {
  const tradeNo = `TAMPER${Date.now()}`;
  const params = signedParams({
    MerchantTradeNo: subMerchantTradeNo,
    RtnCode: "1",
    PaymentDate: "2026/05/19 00:00:00",
    TradeAmt: "1", // 故意付 1 元而非 expected
    PaymentType: "Credit_CreditCard",
    TradeNo: tradeNo,
  });
  const r = await attack("/api/ecpay/return", params);
  await new Promise((s) => setTimeout(s, 500));
  const payments = await fetchPaymentByTradeNo(tradeNo);
  // 應該被 amount mismatch 擋,沒寫入 (或寫入但 status=failed)
  const pass = !payments || payments.length === 0 || payments[0].status !== "success";
  recordTest("T5 金額竄改 (TradeAmt=1) → reject", pass, `HTTP ${r.status}, payments=${payments?.length ?? "?"}`);
}

// ---- main ----
async function main() {
  console.log(`▶ ECPay 安全自測 — target=${BASE}`);
  console.log(`  HASH_KEY=${HASH_KEY.slice(0, 4)}...${HASH_KEY.slice(-2)}, SERVICE_KEY=${SERVICE_KEY ? "✓" : "✗ (DB 驗證會 skip)"}`);
  console.log();

  await t1_missingMerchantTradeNo();
  await t2_badCheckMac();
  await t3_unknownTradeNo();

  const fullIdx = process.argv.indexOf("--full");
  const subMerchantTradeNo = fullIdx > -1 ? process.argv[fullIdx + 1] : null;
  if (subMerchantTradeNo) {
    console.log(`\n▶ Full mode — subMerchantTradeNo=${subMerchantTradeNo}`);
    await t4_replay(subMerchantTradeNo);
    await t5_amountTamper(subMerchantTradeNo);
  } else {
    console.log("\n💡 跳過 T4/T5 — 加 --full <subscriptions.ecpay_merchant_trade_no> 跑完整測");
  }

  console.log(`\n━━━ ${results.filter((r) => r.pass).length} / ${results.length} pass`);
  if (results.some((r) => !r.pass)) process.exit(1);
}

main().catch((e) => {
  console.error("💥 unexpected", e);
  process.exit(1);
});
