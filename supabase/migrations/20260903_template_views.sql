-- template_views：登入用戶「開過哪個付費範本（範例預覽鎖狀態）」的紀錄。
-- 用途：生命週期自動信「你上週看的〈款名〉圖紙」（lib/email/lifecycle-rules.ts）。
-- 寫入點：app/[locale]/design/[type]/page.tsx（previewLocked && user 時，after() 非同步寫，同人同款 24h 內不重複）。
-- 只有 service role 寫讀；RLS 開啟且不加 policy = 一般用戶全擋（比照 lifecycle_emails）。

create table if not exists public.template_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null,
  viewed_at timestamptz not null default now()
);

create index if not exists template_views_user_viewed_idx
  on public.template_views (user_id, viewed_at desc);

alter table public.template_views enable row level security;

comment on table public.template_views is
  '登入用戶開過付費範本（預覽鎖）的紀錄；自動信「你上週看的圖紙」據此挑款';
