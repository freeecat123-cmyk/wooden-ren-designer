# 綠界 ATM / 超商 / 條碼非同步付款支援 — 設計文件

日期：2026-05-21
狀態：設計完成，待實作

## 背景與問題

年付方案結帳走 `lib/ecpay/create-order.ts` 的 `buildAioParams`，使用
`ChoosePayment: "ALL"`。`/pricing` 頁有「月付 / 年付」切換鈕，年付是正式上線功能。

實測（綠界 sandbox 帳號 `2000132`）：訂單被接受，綠界開出 8 種付款方式給使用者，
其中 **ATM 虛擬帳號、超商條碼 (BarCode)、超商代碼 (CVS)** 三種是**非同步取號**：

1. 第一段：使用者選 ATM/超商 → 綠界產生虛擬帳號 / 繳費代碼 → 以幕後 POST 送到
   `PaymentInfoURL`（`RtnCode=2` 為 ATM 取號成功、`10100073` 為超商取號成功）
2. 第二段：使用者實際去 ATM/超商付款 → 綠界送付款結果到 `ReturnURL`（`RtnCode=1`）

現有 code **沒有設 `PaymentInfoURL`**，也沒有對應路由。使用者選了這三種付款方式時，
虛擬帳號 / 繳費代碼只出現在綠界當下的頁面，我方 server 收不到、不寫 DB、不寄 email。
使用者一關掉綠界頁面就找不回號碼，訂單卡死。

信用卡（含月付定期定額）、Apple Pay、TWQR、網路 ATM (WebATM)、GWPay 都是同步的，
不受影響。

## 範圍

完整支援 ATM + 超商代碼 + 超商條碼三種非同步付款。儲存架構採方案 A：擴充 `payments`
表、不新增資料表。

不在範圍：月付（定期定額只能信用卡，本來就沒這問題）；過期未付的取號 row 專屬清理
cron（不做，狀態頁查詢時用 `expireDate > now` 過濾即可）。

## 元件變更

### 1. DB migration — `supabase/migrations/20260521_payments_payment_info.sql`

```sql
-- payments.status 加 'awaiting_payment'（取號成功、等使用者去 ATM/超商繳費）
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('success', 'failed', 'pending', 'refunded', 'awaiting_payment'));

-- 取號資訊（虛擬帳號 / 繳費代碼 / 條碼 + 繳費期限）
alter table public.payments add column if not exists payment_info jsonb;

comment on column public.payments.status is
  'success=付款成功 / failed=失敗 / pending=待綠界回呼 / refunded=已退款 / awaiting_payment=已取號待繳費';
comment on column public.payments.payment_info is
  'ATM/超商/條碼取號資訊：{ method, bankCode?, vAccount?, paymentNo?, barcode1-3?, expireDate }';
```

部署時使用者需自行在 Supabase SQL Editor 跑此 migration。

`payment_info` jsonb 形狀：

```ts
type PaymentInfo = {
  method: "atm" | "cvs" | "barcode";
  expireDate: string;        // ISO，由綠界 ExpireDate 轉
  bankCode?: string;         // ATM
  vAccount?: string;         // ATM 虛擬帳號
  paymentNo?: string;        // 超商代碼
  barcode1?: string;         // 超商條碼三段
  barcode2?: string;
  barcode3?: string;
};
```

### 2. `lib/ecpay/create-order.ts` — `buildAioParams`

`OneTimeOrderInput` 不變。`buildAioParams` 的 params 加一行：

```ts
PaymentInfoURL: `${baseUrl}/api/ecpay/payment-info`,
```

`ClientBackURL` 維持 `/my-subscription?paid=1`（取號後綠界 GET 導回此頁，
狀態頁自己讀 DB 顯示繳費資訊）。不設 `OrderResultURL`（設了綠界改用 POST 導回，
要多一個能接 POST 的路由，沒必要）。

### 3. 新路由 — `app/api/ecpay/payment-info/route.ts`

綠界 `PaymentInfoURL` 的 server-to-server 取號通知。比照 `return/route.ts` 寫法。

流程：
1. `formData()` → params；`verifyCheckMacValue` 失敗回 `0|CheckMacValueInvalid`
2. 用 `MerchantTradeNo` 撈 subscription（`id, user_id, plan, expected_amount`）；找不到回 `1|OK`
3. 驗 `MerchantID` 屬本商家，不符回 `0|MerchantIDInvalid`
4. 判取號成功：ATM `RtnCode==="2"`、超商/條碼 `RtnCode==="10100073"`；
   其他 RtnCode 視為取號失敗，記 log 回 `1|OK`（不寫 DB）
5. 由 `PaymentType` 前綴判 method：`ATM_*`→atm、`CVS_*`→cvs、`BARCODE_*`→barcode
6. 驗金額 `TradeAmt === sub.expected_amount`，不符回 `0|AmountMismatch`
7. 組 `payment_info`：
   - atm：`bankCode`(BankCode)、`vAccount`(vAccount)、`expireDate`(ExpireDate `yyyy/MM/dd`→ISO)
   - cvs：`paymentNo`(PaymentNo)、`expireDate`(ExpireDate `yyyy/MM/dd HH:mm:ss`→ISO)
   - barcode：`barcode1/2/3`(Barcode1/2/3)、`expireDate`
8. idempotency：同 `ecpay_trade_no` 已有 payments row → skip（回 `1|OK`）
9. insert payments row：`status='awaiting_payment'`、`ecpay_trade_no=TradeNo`、
   `amount`、`payment_info`、`raw_response=params`
10. `after()` 背景寄取號通知 email
11. 一律回 `1|OK`

### 4. `app/api/ecpay/return/route.ts` — RtnCode=1 成功分支改 insert-or-update

ATM/超商的取號走 `PaymentInfoURL`、不碰 `ReturnURL`，所以 `return` route 對這些訂單
只會在「真的付款完成」時被呼叫一次（`RtnCode=1`）。屆時 `payments` 已有一筆
`awaiting_payment` row（同 `ecpay_trade_no`，受 UNIQUE 索引保護）。

現有成功分支直接 `insert payments` → 會撞 UNIQUE 衝突。改為：

- 付款成功時先 `select payments where ecpay_trade_no=tradeNo`（任何 status）
- 查到 `awaiting_payment` row → `update` 該 row：`status='success'`、補
  `ecpay_payment_date`、`raw_response`、`invoice_status='pending'`；用該 row id 跑既有 `after()`
- 查到 `success` row → 視為 replay，直接回 `1|OK`（沿用現有 idempotency）
- 查不到（信用卡 / LINE Pay 等同步付款）→ 照舊 `insert`

既有的 `sub.status === "active"` 早退、`select success row` replay 防護都保留。

### 5. 新 email 模板 — `lib/email/templates/payment-pending.ts`

`export function awaitingPaymentEmail(input)` → `{ subject, text, html }`。
比照 `payment-success.ts` 的 `htmlShell`。input：`planLabel`、`amount`、`paymentInfo`。

依 `paymentInfo.method` 顯示：
- atm：銀行代碼 + 虛擬帳號 + 繳費期限 + 「請用網路銀行或 ATM 轉帳」
- cvs：超商代碼 + 期限 + 「請至 7-11/全家/萊爾富/OK 出示代碼繳費」
- barcode：三段條碼數字 + 期限 + 「請至超商出示此頁條碼，或於綠界頁面截圖」

主旨例：「【木頭仁 木作藍圖】訂單已成立，請於 X 前完成繳費」。

### 6. 站內等待繳費卡片

新 API `app/api/my-pending-payment/route.ts`（GET）：用 session 取 user，回該 user
最新一筆 `status='awaiting_payment'` 且 `payment_info.expireDate > now` 的 row
（`{ amount, payment_info }` 或 `null`）。

`components/MySubscriptionClient.tsx`：mount 時 fetch 此 API，有資料就在方案卡片上方
顯示「⏳ 等待繳費」區塊——付款方式、帳號 / 代碼 / 條碼、金額、繳費期限。
條碼類無法畫實體條碼 → 顯示三段數字 + 提示。新增子元件 `PendingPaymentCard`。

### 7. Admin ECPay 看板

`payments` 多了 `awaiting_payment` status 的 row，看板天然查到。狀態中文對應表
補一筆 `awaiting_payment → "等待繳費"`（找 `app/admin/ecpay` 對應的 label map）。

## 測試

- 綠界 sandbox（`2000132`）可實際取號測 ATM。
- 單元測試 `app/api/ecpay/payment-info`：CheckMacValue 驗證、三種 method 的
  `payment_info` 組裝、ExpireDate 轉 ISO、idempotency skip。
- 單元測試 `return` route 的 insert-or-update 分支：有 `awaiting_payment` row → update；
  無 → insert；有 `success` row → replay 早退。
- `npx tsc --noEmit` 通過。

## 部署步驟

1. 使用者在 Supabase SQL Editor 跑 `20260521_payments_payment_info.sql`
2. 部署 code（Vercel）
3. sandbox 走一次 ATM 取號 → 確認收到 email、`/my-subscription` 顯示卡片、
   admin 看板顯示「等待繳費」
4. sandbox 完成繳費 → 確認 `return` route update 成 `success`、發票開立、訂閱啟用
