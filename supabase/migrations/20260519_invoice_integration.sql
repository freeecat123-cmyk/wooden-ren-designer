-- 2026-05-19: 綠界 B2C 電子發票整合
--
-- 為什麼：月扣訂閱每期都要開發票（台灣法規），需在付款 webhook 成功後自動呼叫
-- 綠界 B2C 發票 Issue API，並把發票號碼存進 payments 方便對帳、退款折讓查找。
--
-- 設計重點：
--   - users.invoice_preference jsonb 儲存使用者自選的發票格式（個人手機條碼 / 公司統編）
--   - 缺值 → 走預設（個人、無載具、寄到 user.email）
--   - payments 新增發票相關欄位，open API 失敗也不擋付款 webhook 回 200

alter table public.users
  add column if not exists invoice_preference jsonb;

comment on column public.users.invoice_preference is
  '發票偏好。shape: { type: "personal"|"company", taxId?: 統編8碼, title?: 公司抬頭, carrierType?: "mobile"|"member", carrierNum?: 手機條碼/XXX+XXX, email?: 發票收件信箱 }';

alter table public.payments
  add column if not exists invoice_number text,
  add column if not exists invoice_relate_number text,
  add column if not exists invoice_issued_at timestamptz,
  add column if not exists invoice_status text
    check (invoice_status in ('pending', 'issued', 'failed', 'invalid', 'allowanced'));

comment on column public.payments.invoice_number is '綠界回傳的發票號碼，格式 XX12345678（2 個英文字母 + 8 位數字）';
comment on column public.payments.invoice_relate_number is '我們送給綠界的特店自訂編號（用於後續折讓/作廢查找）';
comment on column public.payments.invoice_status is 'pending=尚未開立 / issued=已開立 / failed=開立失敗待補開 / invalid=已作廢 / allowanced=已折讓';

create index if not exists payments_invoice_number_idx on public.payments (invoice_number);
create index if not exists payments_invoice_status_idx on public.payments (invoice_status)
  where invoice_status in ('pending', 'failed');
