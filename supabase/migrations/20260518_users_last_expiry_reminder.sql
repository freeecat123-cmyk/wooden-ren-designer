-- =============================================================================
-- users.last_expiry_reminder_at
--   訂閱到期 email reminder cron 用：避免每天 cron 跑就重寄信。
--   cron 每天掃 expiringSoon / grace period 的 user、寄信前檢查這欄位、
--   只在 NULL 或 > 5 天前寄過才寄；寄完更新到 now()。
-- =============================================================================

alter table public.users
  add column if not exists last_expiry_reminder_at timestamptz;

comment on column public.users.last_expiry_reminder_at is
  '上次到期 email reminder 寄送時間（NULL = 從沒寄過）。cron sweep + email cron 共用 dedup';
