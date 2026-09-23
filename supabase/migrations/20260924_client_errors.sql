-- client_errors：使用者瀏覽器上炸掉的錯誤。
--
-- 為什麼要有：2026-09-07 有客人按「回報問題」寄了一封空信，我們完全查不到他遇到什麼——
-- 這個網站當時沒有任何錯誤記錄，等於是瞎的。有了這張表，下次就算對方一個字都沒寫，
-- 也查得到他那個時間點在哪一頁炸了什麼。
--
-- 寫入點：app/api/client-error（只有它寫，用 service role）。
-- 讀取點：/admin/errors。
-- RLS 開啟且不加 policy = 一般使用者完全讀不到（比照 template_views / lifecycle_emails）。

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  -- 同一個錯誤重複發生時用這個併在一起（message + 第一行 stack + 路徑 的雜湊）
  fingerprint text not null,
  message text not null,
  stack text,
  -- "error"=window.onerror / "rejection"=未處理的 promise / "boundary"=React 錯誤邊界
  kind text not null default 'error',
  path text,
  user_agent text,
  build text,
  user_id uuid references public.users(id) on delete set null,
  seen_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- 同一個 fingerprint 只留一列，重複發生就累加 seen_count
create unique index if not exists client_errors_fingerprint_key
  on public.client_errors (fingerprint);

create index if not exists client_errors_last_seen_idx
  on public.client_errors (last_seen_at desc);

alter table public.client_errors enable row level security;

comment on table public.client_errors is
  '使用者瀏覽器端的錯誤；同一個 fingerprint 累加 seen_count，/admin/errors 看得到';
