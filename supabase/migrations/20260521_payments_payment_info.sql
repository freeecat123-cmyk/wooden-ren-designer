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
