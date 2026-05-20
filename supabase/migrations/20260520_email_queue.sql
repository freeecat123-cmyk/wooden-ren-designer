-- email_queue：sendEmail retry 全失敗後寫進這張表給 admin 手動 replay。
-- 目的：賣量大時 Resend 撞 quota / API 暫掛、不致用戶完全收不到 critical
-- transactional 信（歡迎信、付款通知）。先記下，事後人工 replay。
--
-- replay 流程（暫無 UI，admin 直接走 SQL）：
--   1. select * from email_queue where status='failed' order by created_at;
--   2. 依 to_email/subject 判斷是否還需要寄（如已過期則 status='skipped'）
--   3. 透過 admin endpoint / 手動觸發 sendEmail 重寄
--   4. 成功後 update status='replayed_ok', replayed_at=now()

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  text_body text not null,
  html_body text not null,
  from_email text,
  -- failure_kind 用來分流：rate_limit / quota / validation / network / unknown
  failure_kind text,
  error text,
  retry_count int not null default 3,  -- sendEmail 內 retry 過 3 次才進 queue
  status text not null default 'failed' check (status in ('failed', 'replayed_ok', 'replayed_failed', 'skipped')),
  created_at timestamptz not null default now(),
  replayed_at timestamptz
);

create index if not exists email_queue_status_created_idx
  on public.email_queue (status, created_at desc);

comment on table public.email_queue is
  'Resend 寄送失敗的 transactional emails 保留區。admin 可從 status=failed 撈出來判斷是否 replay';
