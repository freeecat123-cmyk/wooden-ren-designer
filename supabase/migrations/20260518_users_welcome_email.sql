-- =============================================================================
-- users.welcome_email_sent_at
--   新註冊歡迎信寄送旗標。NULL = 還沒寄過 / 還沒登入過。
--   OAuth callback 偵測 NULL → 寄歡迎信 → 更新 timestamp。下次再登入不重寄。
-- =============================================================================

alter table public.users
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.users.welcome_email_sent_at is
  '歡迎信寄送時間（NULL = 沒寄過）。OAuth callback 第一次登入時偵測 NULL 寄信';
