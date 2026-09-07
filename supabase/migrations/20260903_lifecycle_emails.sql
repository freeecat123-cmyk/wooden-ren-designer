-- lifecycle_emails：生命週期自動信寄送紀錄（新註冊 d1/d3/d7、舊免費用戶回訪、到期回流）。
-- 每人每個 email_key 只寄一次；cron /api/cron/lifecycle-emails 寄前查這張表 dedup。
-- email_key 值：new_d1 / new_d3 / new_d7 / reengage_1 / reengage_2 / winback

create table if not exists public.lifecycle_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  email_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, email_key)
);

create index if not exists lifecycle_emails_user_idx
  on public.lifecycle_emails (user_id);

-- RLS：cron 用 service role 寫（自動 bypass）、一般用戶完全擋（沒 policy = 全拒絕）。
-- 比照 email_broadcasts。
alter table public.lifecycle_emails enable row level security;

comment on table public.lifecycle_emails is
  '生命週期自動信寄送紀錄：每人每個 email_key 一筆，cron 據此不重寄';
