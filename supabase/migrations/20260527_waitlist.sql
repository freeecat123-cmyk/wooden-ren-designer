-- English version Coming Soon waitlist
-- 收集英文版開賣前的 email，啟用後寄通知

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  locale text not null default 'en',
  source text,                              -- e.g. 'en-coming-soon'
  ip_country text,                          -- 從 request header 帶
  user_agent text,
  notes text,
  notified_at timestamptz,                  -- 寄發英文版上線通知後填
  created_at timestamptz not null default now()
);

-- email 同 locale 不可重複（換 locale 視為新訂閱）
create unique index if not exists waitlist_email_locale_unique
  on public.waitlist (lower(email), locale);

-- index for admin/cron lookups by source/created
create index if not exists waitlist_source_created_idx
  on public.waitlist (source, created_at desc);

-- RLS：只有 service role 能讀寫；公開 endpoint 用 service role key 從 API route 寫入
alter table public.waitlist enable row level security;

-- 不開放任何 anon/authenticated 直接讀寫；全部走 /api/waitlist
-- (沒有 policy = 預設拒絕所有非 service-role 操作)

comment on table public.waitlist is
  'Pre-launch email signups (English version 卡位 Coming Soon page). Service role only.';
