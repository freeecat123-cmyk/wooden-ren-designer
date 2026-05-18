-- =============================================================================
-- subscriptions.expected_amount：checkout 時就把預期金額寫進 placeholder row。
--
-- 原問題：webhook 只能從 sub.plan（basePlan='personal'|'pro'）反推應收金額，
-- 但 student tier（student_personal=219, student_pro=690）會塌成 basePlan
-- → 學員方案 student 付 219 NTD 時、webhook 期望 390 → AmountMismatch 永遠 reject。
--
-- 新方案：checkout 時計算 expected_amount 一起寫入；webhook 直接讀 sub.expected_amount
-- 比對 callback 的 TradeAmt，跨 plan 都正確。
-- =============================================================================

alter table public.subscriptions
  add column if not exists expected_amount integer;

comment on column public.subscriptions.expected_amount is
  '建立 placeholder subscription 時寫入的「預期收款金額」(NTD)。webhook 用這個比對防 amount tampering，跨 student/regular plan 都一致。';
