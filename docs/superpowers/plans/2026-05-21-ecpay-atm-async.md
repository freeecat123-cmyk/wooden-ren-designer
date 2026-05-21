# 綠界 ATM / 超商 / 條碼非同步付款支援 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓年付方案的 ATM 虛擬帳號 / 超商代碼 / 超商條碼付款能被 server 收到、記錄、通知使用者，並在使用者實際繳費後自動啟用訂閱與開發票。

**Architecture:** 綠界以幕後 POST 把取號結果送到 `PaymentInfoURL`（新路由），存進 `payments` 表一筆 `awaiting_payment` row。使用者實際繳費後綠界打 `ReturnURL`，把該 row 由 `awaiting_payment` 更新成 `success`，沿用既有的發票/email 後處理。

**Tech Stack:** Next.js (App Router, `route.ts`)、Supabase（`createAdminClient`）、綠界 ECPay AIO、TypeScript。本 repo 無單元測試 runner，純函式以 `npx tsx` smoke script 驗證，其餘以 `npx tsc --noEmit` + 綠界 sandbox 手動驗收。

設計來源：`docs/superpowers/specs/2026-05-21-ecpay-atm-async-design.md`

---

### Task 1: DB migration

**Files:**
- Create: `supabase/migrations/20260521_payments_payment_info.sql`

- [ ] **Step 1: 寫 migration**

```sql
-- 2026-05-21: payments 支援 ATM/超商/條碼非同步付款
--
-- Why: 年付走 ChoosePayment=ALL，使用者可選 ATM/超商/條碼（非同步取號）。
-- 取號成功時先記一筆 awaiting_payment，使用者實際繳費後再更新成 success。

alter table public.payments drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('success', 'failed', 'pending', 'refunded', 'awaiting_payment'));

alter table public.payments
  add column if not exists payment_info jsonb;

comment on column public.payments.status is
  'success=付款成功 / failed=失敗 / pending=待綠界回呼 / refunded=已退款 / awaiting_payment=已取號待繳費';
comment on column public.payments.payment_info is
  'ATM/超商/條碼取號資訊 jsonb：{ method, expireDate, bankCode?, vAccount?, paymentNo?, barcode1-3? }';
```

- [ ] **Step 2: 驗證（部署時由使用者在 Supabase SQL Editor 跑）**

此檔不需在本機執行，列入「部署步驟」交付清單即可。

---

### Task 2: 取號參數解析純函式

**Files:**
- Create: `lib/ecpay/payment-info.ts`
- Test: `scripts/_verify-payment-info.ts`（驗證後刪除）

- [ ] **Step 1: 寫純函式**

```ts
// lib/ecpay/payment-info.ts
/**
 * 綠界 ATM/超商/條碼「取號」回呼參數的解析。
 * 純函式，不碰 DB / 不打網路，方便獨立驗證。
 */

export type PaymentMethod = "atm" | "cvs" | "barcode";

/** 寫進 payments.payment_info jsonb 的形狀 */
export interface PaymentInfo {
  method: PaymentMethod;
  /** 繳費期限，ISO 字串 */
  expireDate: string;
  bankCode?: string; // ATM
  vAccount?: string; // ATM 虛擬帳號
  paymentNo?: string; // 超商代碼
  barcode1?: string; // 超商條碼三段
  barcode2?: string;
  barcode3?: string;
}

/**
 * 綠界 ExpireDate 轉 ISO。
 * ATM 格式 "yyyy/MM/dd"；超商/條碼格式 "yyyy/MM/dd HH:mm:ss"。皆視為 UTC+8。
 */
export function parseEcpayExpireDate(s: string | undefined): string | null {
  if (!s) return null;
  const full = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (full) {
    return new Date(
      `${full[1]}-${full[2]}-${full[3]}T${full[4]}:${full[5]}:${full[6]}+08:00`,
    ).toISOString();
  }
  const dateOnly = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (dateOnly) {
    // 只有日期 → 當天 23:59:59 截止
    return new Date(
      `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T23:59:59+08:00`,
    ).toISOString();
  }
  return null;
}

/** 取號是否成功：ATM RtnCode=2、超商/條碼 RtnCode=10100073 */
export function isGetCodeSuccess(rtnCode: string | undefined): boolean {
  return rtnCode === "2" || rtnCode === "10100073";
}

/** 由綠界 PaymentType 前綴判付款方式（ATM_TAISHIN / CVS_CVS / BARCODE_BARCODE …） */
export function classifyPaymentMethod(
  paymentType: string | undefined,
): PaymentMethod | null {
  if (!paymentType) return null;
  if (paymentType.startsWith("ATM_")) return "atm";
  if (paymentType.startsWith("CVS_")) return "cvs";
  if (paymentType.startsWith("BARCODE_")) return "barcode";
  return null;
}

/**
 * 從取號回呼 params 組出 PaymentInfo。
 * 缺必要欄位（method 判不出 / 無 expireDate / 無帳號代碼）回 null。
 */
export function buildPaymentInfo(
  params: Record<string, string>,
): PaymentInfo | null {
  const method = classifyPaymentMethod(params.PaymentType);
  if (!method) return null;
  const expireDate = parseEcpayExpireDate(params.ExpireDate);
  if (!expireDate) return null;

  if (method === "atm") {
    if (!params.BankCode || !params.vAccount) return null;
    return {
      method,
      expireDate,
      bankCode: params.BankCode,
      vAccount: params.vAccount,
    };
  }
  if (method === "cvs") {
    if (!params.PaymentNo) return null;
    return { method, expireDate, paymentNo: params.PaymentNo };
  }
  // barcode
  if (!params.Barcode1) return null;
  return {
    method,
    expireDate,
    barcode1: params.Barcode1,
    barcode2: params.Barcode2,
    barcode3: params.Barcode3,
  };
}
```

- [ ] **Step 2: 寫驗證 script**

```ts
// scripts/_verify-payment-info.ts
import {
  parseEcpayExpireDate,
  isGetCodeSuccess,
  classifyPaymentMethod,
  buildPaymentInfo,
} from "../lib/ecpay/payment-info";

let pass = 0;
let fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else {
    fail++;
    console.error(`FAIL ${name}\n  got : ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
  }
}

check("expire date-only", parseEcpayExpireDate("2026/06/01"), "2026-06-01T15:59:59.000Z");
check("expire datetime", parseEcpayExpireDate("2026/06/01 12:00:00"), "2026-06-01T04:00:00.000Z");
check("expire bad", parseEcpayExpireDate("xxx"), null);
check("getcode atm", isGetCodeSuccess("2"), true);
check("getcode cvs", isGetCodeSuccess("10100073"), true);
check("getcode fail", isGetCodeSuccess("1"), false);
check("method atm", classifyPaymentMethod("ATM_TAISHIN"), "atm");
check("method cvs", classifyPaymentMethod("CVS_CVS"), "cvs");
check("method barcode", classifyPaymentMethod("BARCODE_BARCODE"), "barcode");
check("method unknown", classifyPaymentMethod("Credit_CreditCard"), null);

check(
  "buildPaymentInfo atm",
  buildPaymentInfo({ PaymentType: "ATM_TAISHIN", ExpireDate: "2026/06/01", BankCode: "812", vAccount: "9103522175887271" }),
  { method: "atm", expireDate: "2026-06-01T15:59:59.000Z", bankCode: "812", vAccount: "9103522175887271" },
);
check(
  "buildPaymentInfo cvs",
  buildPaymentInfo({ PaymentType: "CVS_CVS", ExpireDate: "2026/06/01 23:59:59", PaymentNo: "LLL26050100001" }),
  { method: "cvs", expireDate: "2026-06-01T15:59:59.000Z", paymentNo: "LLL26050100001" },
);
check(
  "buildPaymentInfo barcode",
  buildPaymentInfo({ PaymentType: "BARCODE_BARCODE", ExpireDate: "2026/06/01 23:59:59", Barcode1: "A", Barcode2: "B", Barcode3: "C" }),
  { method: "barcode", expireDate: "2026-06-01T15:59:59.000Z", barcode1: "A", barcode2: "B", barcode3: "C" },
);
check("buildPaymentInfo atm 缺 vAccount", buildPaymentInfo({ PaymentType: "ATM_TAISHIN", ExpireDate: "2026/06/01", BankCode: "812" }), null);
check("buildPaymentInfo 未知 method", buildPaymentInfo({ PaymentType: "Credit", ExpireDate: "2026/06/01" }), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: 跑驗證**

Run: `npx tsx scripts/_verify-payment-info.ts`
Expected: `16 passed, 0 failed`

- [ ] **Step 4: 刪除驗證 script**

Run: `rm scripts/_verify-payment-info.ts`

---

### Task 3: 結帳加上 PaymentInfoURL

**Files:**
- Modify: `lib/ecpay/create-order.ts`（`buildAioParams`，約 line 42-61）

- [ ] **Step 1: 在 `buildAioParams` 的 params 物件加一行**

在 `ChoosePayment: "ALL",` 下一行、`EncryptType: "1",` 之前加：

```ts
    PaymentInfoURL: `${baseUrl}/api/ecpay/payment-info`,
```

加完後 params 物件含：`...ChoosePayment: "ALL", PaymentInfoURL: \`${baseUrl}/api/ecpay/payment-info\`, EncryptType: "1",`

`buildPeriodicParams` **不動**（月付定期定額只能信用卡，無取號）。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

---

### Task 4: 取號通知 email 模板

**Files:**
- Create: `lib/email/templates/payment-pending.ts`

- [ ] **Step 1: 寫模板**

```ts
// lib/email/templates/payment-pending.ts
/**
 * 取號成功 email：ATM/超商/條碼下單後，綠界 /payment-info webhook 觸發。
 * 內容是繳費資訊（虛擬帳號 / 超商代碼 / 條碼）+ 繳費期限。
 */
import { escapeHtml } from "../escape";
import type { PaymentInfo } from "../../ecpay/payment-info";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  // 顯示台北時間
  const t = new Date(d.getTime() + 8 * 3600_000);
  return `${t.getUTCFullYear()}/${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

function htmlShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="font-size:20px;margin:0 0 16px;color:#0f172a">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">木頭仁 木作藍圖 · <a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

interface AwaitingPaymentInput {
  planLabel: string;
  amount: number;
  paymentInfo: PaymentInfo;
}

/** 依付款方式產生繳費說明的純文字行 + HTML 區塊 */
function describe(info: PaymentInfo): { textLines: string[]; html: string } {
  if (info.method === "atm") {
    return {
      textLines: [
        `付款方式：ATM 轉帳`,
        `銀行代碼：${info.bankCode}`,
        `虛擬帳號：${info.vAccount}`,
        `請用網路銀行或實體 ATM 轉帳至上述帳號。`,
      ],
      html: `<table style="width:100%;border-collapse:collapse;margin-top:8px">
<tr><td style="padding:8px 0;color:#6b7280">付款方式</td><td style="text-align:right;font-weight:600">ATM 轉帳</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">銀行代碼</td><td style="text-align:right;font-family:monospace;font-weight:600;border-top:1px solid #e5e7eb">${escapeHtml(info.bankCode ?? "")}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">虛擬帳號</td><td style="text-align:right;font-family:monospace;font-weight:600;font-size:16px;border-top:1px solid #e5e7eb">${escapeHtml(info.vAccount ?? "")}</td></tr>
</table>
<p style="font-size:13px;color:#6b7280;margin-top:8px">請用網路銀行或實體 ATM 轉帳至上述帳號。</p>`,
    };
  }
  if (info.method === "cvs") {
    return {
      textLines: [
        `付款方式：超商代碼繳費`,
        `繳費代碼：${info.paymentNo}`,
        `請至 7-11 / 全家 / 萊爾富 / OK 超商，用多媒體機輸入代碼繳費。`,
      ],
      html: `<table style="width:100%;border-collapse:collapse;margin-top:8px">
<tr><td style="padding:8px 0;color:#6b7280">付款方式</td><td style="text-align:right;font-weight:600">超商代碼繳費</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">繳費代碼</td><td style="text-align:right;font-family:monospace;font-weight:600;font-size:16px;border-top:1px solid #e5e7eb">${escapeHtml(info.paymentNo ?? "")}</td></tr>
</table>
<p style="font-size:13px;color:#6b7280;margin-top:8px">請至 7-11 / 全家 / 萊爾富 / OK 超商，用多媒體機輸入代碼繳費。</p>`,
    };
  }
  // barcode
  return {
    textLines: [
      `付款方式：超商條碼繳費`,
      `條碼一：${info.barcode1}`,
      `條碼二：${info.barcode2}`,
      `條碼三：${info.barcode3}`,
      `請至超商出示此三段條碼繳費（可於綠界頁面截圖條碼）。`,
    ],
    html: `<table style="width:100%;border-collapse:collapse;margin-top:8px">
<tr><td style="padding:8px 0;color:#6b7280">付款方式</td><td style="text-align:right;font-weight:600">超商條碼繳費</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">條碼一</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(info.barcode1 ?? "")}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">條碼二</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(info.barcode2 ?? "")}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">條碼三</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(info.barcode3 ?? "")}</td></tr>
</table>
<p style="font-size:13px;color:#6b7280;margin-top:8px">請至超商出示此三段條碼繳費（可於綠界頁面截圖條碼）。</p>`,
  };
}

export function awaitingPaymentEmail(input: AwaitingPaymentInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { planLabel, amount, paymentInfo } = input;
  const deadline = formatDateTime(paymentInfo.expireDate);
  const d = describe(paymentInfo);
  const subject = `訂單已成立，請於 ${deadline} 前完成繳費 — ${planLabel}`;
  const text = [
    `木頭仁 木作藍圖 — 訂單已成立`,
    ``,
    `方案：${planLabel}（年付）`,
    `應繳金額：NT$ ${amount}`,
    `繳費期限：${deadline}`,
    ``,
    ...d.textLines,
    ``,
    `完成繳費後訂閱會自動啟用，並寄出付款成功通知與電子發票。`,
    `也可在「我的訂閱」頁查看繳費資訊：${SITE_URL}/my-subscription`,
    ``,
    `木頭仁 木作藍圖`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p style="background:#fffbeb;border:2px solid #fbbf24;border-radius:8px;padding:12px;color:#92400e;font-weight:600">
⏳ 訂單已成立，尚未收到款項。請於 <strong>${deadline}</strong> 前完成繳費。
</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;color:#6b7280">方案</td><td style="text-align:right;font-weight:600">${escapeHtml(planLabel)}（年付）</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">應繳金額</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb">NT$ ${amount.toLocaleString()}</td></tr>
</table>
${d.html}
<p style="font-size:14px;color:#6b7280;margin-top:16px">完成繳費後訂閱會自動啟用，並寄出付款成功通知與電子發票。</p>
<p><a href="${SITE_URL}/my-subscription" style="display:inline-block;background:#d97706;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">查看我的訂閱 →</a></p>`,
  );
  return { subject, text, html };
}
```

注意：`import { escapeHtml } from "../escape";` 與 `payment-success.ts` 同路徑慣例；若 `lib/email/escape.ts` 不存在，改用 `payment-success.ts` 實際 import 的路徑。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

---

### Task 5: 取號通知路由 `/api/ecpay/payment-info`

**Files:**
- Create: `app/api/ecpay/payment-info/route.ts`

- [ ] **Step 1: 寫路由**

```ts
/**
 * POST /api/ecpay/payment-info
 *   綠界 PaymentInfoURL — ATM / 超商代碼 / 超商條碼的「取號成功」幕後通知。
 *
 * 收到後流程:
 *   1. 驗 CheckMacValue + MerchantID
 *   2. 透過 MerchantTradeNo 撈回 placeholder subscription
 *   3. 取號成功（ATM RtnCode=2 / 超商 RtnCode=10100073）→
 *        - 驗金額
 *        - 組 payment_info（虛擬帳號 / 代碼 / 條碼 + 期限）
 *        - payments insert status=awaiting_payment（同 ecpay_trade_no 已存在則 skip）
 *        - 背景寄取號通知 email
 *   4. 取號失敗 → 記 log，不寫 DB
 *   5. 一律回 "1|OK"
 *
 * 使用者實際繳費後綠界打 /api/ecpay/return（RtnCode=1），那支會把這筆
 * awaiting_payment 更新成 success。
 */
import { type NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCheckMacValue } from "@/lib/ecpay/check-mac-value";
import { ECPAY_HASH_IV, ECPAY_HASH_KEY } from "@/lib/ecpay/config";
import { isGetCodeSuccess, buildPaymentInfo } from "@/lib/ecpay/payment-info";
import { sendEmail } from "@/lib/email/send";
import { awaitingPaymentEmail } from "@/lib/email/templates/payment-pending";
import { planLabelFromUserPlan } from "@/lib/email/templates/subscription-expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = String(v);
  });

  if (!verifyCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV)) {
    console.error("[ecpay/payment-info] CheckMacValue 驗證失敗", {
      orderId: params.MerchantTradeNo,
    });
    return new Response("0|CheckMacValueInvalid", { status: 200 });
  }

  const orderId = params.MerchantTradeNo;
  const tradeNo = params.TradeNo ?? null;
  const amount = Number(params.TradeAmt ?? 0);

  const admin = createAdminClient();
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, expected_amount")
    .eq("ecpay_merchant_trade_no", orderId)
    .single();

  if (subErr || !sub) {
    console.error("[ecpay/payment-info] 找不到 subscription", { orderId, subErr });
    return new Response("1|OK");
  }

  if (params.MerchantID !== process.env.ECPAY_MERCHANT_ID) {
    console.error("[ecpay/payment-info] MerchantID mismatch or missing", {
      got: params.MerchantID,
      expected: process.env.ECPAY_MERCHANT_ID,
    });
    return new Response("0|MerchantIDInvalid", { status: 200 });
  }

  // 取號失敗 → 記 log、不寫 DB
  if (!isGetCodeSuccess(params.RtnCode)) {
    console.warn("[ecpay/payment-info] 取號失敗", {
      orderId,
      rtnCode: params.RtnCode,
      msg: params.RtnMsg,
    });
    return new Response("1|OK");
  }

  // 驗金額
  if (!sub.expected_amount || amount !== sub.expected_amount) {
    console.error("[ecpay/payment-info] amount mismatch", {
      orderId,
      got: amount,
      expected: sub.expected_amount,
    });
    return new Response("0|AmountMismatch", { status: 200 });
  }

  const paymentInfo = buildPaymentInfo(params);
  if (!paymentInfo) {
    console.error("[ecpay/payment-info] 取號參數不完整,無法組 payment_info", {
      orderId,
      paymentType: params.PaymentType,
    });
    return new Response("1|OK");
  }

  // idempotency: 同 ecpay_trade_no 已有 payment row → skip
  if (tradeNo) {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("ecpay_trade_no", tradeNo)
      .maybeSingle();
    if (existing) {
      console.warn("[ecpay/payment-info] 同 trade_no 已存在,skip", { orderId, tradeNo });
      return new Response("1|OK");
    }
  }

  const { error: insErr } = await admin.from("payments").insert({
    user_id: sub.user_id,
    subscription_id: sub.id,
    amount,
    status: "awaiting_payment",
    ecpay_trade_no: tradeNo,
    payment_info: paymentInfo as unknown as Record<string, unknown>,
    raw_response: params as Record<string, unknown>,
  });
  if (insErr) {
    console.error("[ecpay/payment-info] payments insert 失敗", { orderId, insErr });
    return new Response("1|OK");
  }

  console.log("[ecpay/payment-info] 取號成功,已記 awaiting_payment", {
    orderId,
    method: paymentInfo.method,
  });

  // 背景寄取號通知 email
  after(async () => {
    try {
      const { data: u } = await admin
        .from("users")
        .select("email")
        .eq("id", sub.user_id)
        .single();
      if (u?.email) {
        const payload = awaitingPaymentEmail({
          planLabel: planLabelFromUserPlan(sub.plan),
          amount,
          paymentInfo,
        });
        await sendEmail({
          to: u.email,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        });
      }
    } catch (e) {
      console.warn("[ecpay/payment-info:after] 取號通知 email 例外", e);
    }
  });

  return new Response("1|OK");
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。若 `payments` 的 Supabase 型別不認 `payment_info` / `awaiting_payment`，沿用本 repo 既有 `as Record<string, unknown>` cast 慣例（`return/route.ts` 對 `raw_response` 也是這樣處理）。

---

### Task 6: return route 改 insert-or-update

**Files:**
- Modify: `app/api/ecpay/return/route.ts`（成功分支，約 line 175-188 的 `insert payments`）

- [ ] **Step 1: 把成功分支的 `insert payments` 改成 insert-or-update**

現有 code（約 line 175-188）：

```ts
  const { data: insertedPayment } = await admin
    .from("payments")
    .insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount,
      status: "success",
      ecpay_trade_no: tradeNo,
      ecpay_payment_date: paymentDate,
      raw_response: params as Record<string, unknown>,
      invoice_status: "pending",
    })
    .select("id")
    .single();
```

改成：

```ts
  // ATM/超商先前可能已由 /payment-info 寫過一筆 awaiting_payment row（同 ecpay_trade_no）。
  // 有就 update 成 success，沒有（信用卡/LINE Pay 等同步付款）就 insert。
  let insertedPayment: { id: string } | null = null;
  const { data: existingRow } = tradeNo
    ? await admin
        .from("payments")
        .select("id, status")
        .eq("ecpay_trade_no", tradeNo)
        .maybeSingle()
    : { data: null };

  if (existingRow?.status === "awaiting_payment") {
    const { data: updated } = await admin
      .from("payments")
      .update({
        status: "success",
        ecpay_payment_date: paymentDate,
        raw_response: params as Record<string, unknown>,
        invoice_status: "pending",
      })
      .eq("id", existingRow.id)
      .select("id")
      .single();
    insertedPayment = updated ?? null;
  } else if (!existingRow) {
    const { data: inserted } = await admin
      .from("payments")
      .insert({
        user_id: sub.user_id,
        subscription_id: sub.id,
        amount,
        status: "success",
        ecpay_trade_no: tradeNo,
        ecpay_payment_date: paymentDate,
        raw_response: params as Record<string, unknown>,
        invoice_status: "pending",
      })
      .select("id")
      .single();
    insertedPayment = inserted ?? null;
  }
  // existingRow.status 已是 success → replay，insertedPayment 維持 null，
  // 下方 after() 會因 !insertedPayment?.id 自動跳過後處理。
```

下方既有 `after(async () => { if (!insertedPayment?.id) { ... return; } ... })` 不動——
`insertedPayment` 型別現在是 `{ id: string } | null`，`insertedPayment?.id` 仍合法。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

---

### Task 7: 使用者待繳費查詢 API

**Files:**
- Create: `app/api/my-pending-payment/route.ts`

- [ ] **Step 1: 寫 API**

```ts
/**
 * GET /api/my-pending-payment
 *   回登入使用者最新一筆「已取號待繳費」且未過期的 payment。
 *   給 /my-subscription 顯示繳費資訊卡片用。回 { pending: {...} | null }。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ pending: null });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("payments")
    .select("amount, payment_info, created_at")
    .eq("user_id", user.id)
    .eq("status", "awaiting_payment")
    .order("created_at", { ascending: false })
    .limit(5);

  const now = Date.now();
  const pending =
    (rows ?? [])
      .map((r) => ({
        amount: r.amount as number,
        paymentInfo: r.payment_info as {
          method: string;
          expireDate: string;
          [k: string]: unknown;
        } | null,
      }))
      .find(
        (r) =>
          r.paymentInfo &&
          typeof r.paymentInfo.expireDate === "string" &&
          new Date(r.paymentInfo.expireDate).getTime() > now,
      ) ?? null;

  return NextResponse.json({ pending });
}
```

注意：`createClient`（session 版）與 `createAdminClient` 的實際 import 路徑以 `app/api/admin/whitelist/route.ts`、`app/api/ecpay/return/route.ts` 的既有 import 為準（前者 `@/lib/supabase/server` 的 `createClient`，後者 `createAdminClient`）。若兩者不在同一檔案，分別 import。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

---

### Task 8: 「我的訂閱」等待繳費卡片

**Files:**
- Modify: `components/MySubscriptionClient.tsx`

- [ ] **Step 1: 加 `PendingPaymentCard` 子元件 + fetch**

在 `MySubscriptionClient.tsx` 內，於既有 `MySubscriptionClient` 元件加一段 state + effect，
並在方案卡片上方 render `<PendingPaymentCard />`。新增子元件：

```tsx
interface PendingPayment {
  amount: number;
  paymentInfo: {
    method: "atm" | "cvs" | "barcode";
    expireDate: string;
    bankCode?: string;
    vAccount?: string;
    paymentNo?: string;
    barcode1?: string;
    barcode2?: string;
    barcode3?: string;
  } | null;
}

function PendingPaymentCard() {
  const [pending, setPending] = useState<PendingPayment | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/my-pending-payment")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setPending(d.pending ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!pending?.paymentInfo) return null;
  const info = pending.paymentInfo;
  const deadline = new Date(info.expireDate).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold text-amber-900">⏳ 等待繳費</p>
      <p className="mt-1 text-sm text-amber-800">
        應繳 NT$ {pending.amount.toLocaleString()}，請於 {deadline} 前完成繳費，
        繳費後訂閱會自動啟用。
      </p>
      <div className="mt-3 space-y-1 text-sm">
        {info.method === "atm" && (
          <>
            <Row label="付款方式" value="ATM 轉帳" />
            <Row label="銀行代碼" value={info.bankCode ?? ""} mono />
            <Row label="虛擬帳號" value={info.vAccount ?? ""} mono />
          </>
        )}
        {info.method === "cvs" && (
          <>
            <Row label="付款方式" value="超商代碼繳費" />
            <Row label="繳費代碼" value={info.paymentNo ?? ""} mono />
          </>
        )}
        {info.method === "barcode" && (
          <>
            <Row label="付款方式" value="超商條碼繳費" />
            <Row label="條碼一" value={info.barcode1 ?? ""} mono />
            <Row label="條碼二" value={info.barcode2 ?? ""} mono />
            <Row label="條碼三" value={info.barcode3 ?? ""} mono />
            <p className="pt-1 text-xs text-amber-700">
              請至超商出示三段條碼繳費。
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-amber-700">{label}</span>
      <span className={mono ? "font-mono font-semibold text-amber-900" : "font-semibold text-amber-900"}>
        {value}
      </span>
    </div>
  );
}
```

在 `MySubscriptionClient` 的 JSX 中，方案卡片區塊之前插入 `<PendingPaymentCard />`。
（實際插入位置依檔案現有結構，放在登入使用者會看到的主內容區頂部。）

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

---

### Task 9: admin 看板狀態標籤

**Files:**
- Modify: `components/admin/EcpayLogClient.tsx`（`STATUS_STYLE` line ~42、`STATUS_ZH` line ~48）

- [ ] **Step 1: 兩個 map 各加一筆**

`STATUS_STYLE` 加：

```ts
  awaiting_payment: "bg-amber-100 text-amber-800 ring-amber-200",
```

`STATUS_ZH` 加：

```ts
  awaiting_payment: "等待繳費",
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

---

### Task 10: 全案最終驗證

- [ ] **Step 1: 全專案型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 2: overlap audit 確認沒誤傷家具模板（理論上無關，保險起見）**

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: overlap 數字與改動前一致

- [ ] **Step 3: 綠界 sandbox 取號實測（交付後手動）**

部署 + 跑 migration 後，於 sandbox 走一次 ATM 取號：
- 確認收到取號通知 email
- `/my-subscription` 顯示「⏳ 等待繳費」卡片
- `/admin/ecpay` 看板顯示「等待繳費」狀態
- sandbox 完成繳費 → 該 row 轉 `success`、發票開立、訂閱啟用

- [ ] **Step 4: commit（經使用者同意後）**

```bash
git add supabase/migrations/20260521_payments_payment_info.sql \
  lib/ecpay/payment-info.ts lib/ecpay/create-order.ts \
  lib/email/templates/payment-pending.ts \
  app/api/ecpay/payment-info/route.ts app/api/ecpay/return/route.ts \
  app/api/my-pending-payment/route.ts \
  components/MySubscriptionClient.tsx components/admin/EcpayLogClient.tsx \
  docs/superpowers/specs/2026-05-21-ecpay-atm-async-design.md \
  docs/superpowers/plans/2026-05-21-ecpay-atm-async.md
git commit -m "feat(ecpay): 支援 ATM/超商/條碼非同步付款取號與待繳費通知"
```

---

## 部署步驟交付清單（給使用者）

1. 在 Supabase SQL Editor 跑 `supabase/migrations/20260521_payments_payment_info.sql`
2. 部署 code（Vercel）
3. 確認 Vercel 有 `NEXT_PUBLIC_SITE_URL`（綠界 PaymentInfoURL 靠它組）— 既有設定應已有
4. sandbox 取號實測（Task 10 Step 3）
