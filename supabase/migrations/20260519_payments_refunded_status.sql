-- 2026-05-19: payments.status 加 'refunded' 狀態
--
-- Why: /admin/refunds 的 update payments set status='refunded' 一直在 silently 失敗
-- （違反 check constraint，但 supabase-js 沒 throw、用 error 物件回，admin route 沒檢查）。
-- 結果 DB 永遠看不到 refunded 狀態，對帳全亂。
--
-- 同時加 'voided' / 'allowanced' 不放——這兩個是發票狀態，已經分到 payments.invoice_status

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('success', 'failed', 'pending', 'refunded'));

comment on column public.payments.status is
  'success=付款成功 / failed=失敗 / pending=待綠界回呼 / refunded=已退款（保留原 amount，用 status 區分）';
