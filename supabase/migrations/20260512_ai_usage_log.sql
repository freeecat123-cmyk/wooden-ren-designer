-- AI 用量計數表：每次呼叫 Claude API（photo-to-params / style-suggest）寫一筆
-- 用 Asia/Taipei 日界線重置；wood-master 走 Upstash IP 限流不在這裡

create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint in ('photo-to-params', 'style-suggest')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_user_day_idx
  on public.ai_usage_log (user_id, created_at desc);

alter table public.ai_usage_log enable row level security;

-- 只允許本人讀自己的紀錄（除錯用），寫入只由 server route 用 service role 做
create policy "users read own ai usage"
  on public.ai_usage_log for select
  using (auth.uid() = user_id);
