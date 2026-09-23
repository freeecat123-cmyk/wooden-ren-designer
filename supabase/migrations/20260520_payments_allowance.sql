-- 2026-05-20: 發票折讓（Allowance）— 跨 24h 退費走折讓單，不能作廢
--
-- 為什麼：年付方案 NT$1,990 幾乎一定跨 24h 退費，發票 Invalid 作廢做不到，
-- 只能呼叫綠界 /B2CInvoice/Allowance 開折讓單抵減金額。
-- 折讓單號（IA_Allow_No）跟原發票號分開存，方便日後對帳。

alter table public.payments
  add column if not exists allowance_number text,
  add column if not exists allowance_issued_at timestamptz,
  add column if not exists allowance_amount integer;

comment on column public.payments.allowance_number is
  '綠界折讓單號 IA_Allow_No（格式 16 碼），跨 24h 退費時開的折讓單';
comment on column public.payments.allowance_issued_at is '折讓單開立時間（綠界回傳 IA_Date）';
comment on column public.payments.allowance_amount is '折讓金額（含稅，整數 NTD）。部分退款時不等於原發票 amount';

create index if not exists payments_allowance_number_idx on public.payments (allowance_number)
  where allowance_number is not null;
