-- 開發票失敗時把綠界回的錯誤訊息存進來,給 admin 看板顯示 + retry 用。
-- 不靠 Vercel log (Hobby plan 1 小時就消失,事後追不到原因)。

alter table public.payments
  add column if not exists invoice_error_message text;
