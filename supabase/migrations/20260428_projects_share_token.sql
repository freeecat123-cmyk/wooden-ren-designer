-- 公開分享 token：木工的客戶（不是付費用戶）需要在不登入的狀態看報價
-- 為什麼用獨立欄位而非 RLS：客戶端沒 JWT，RLS 沒法判斷；改在 server 用 admin
-- client 對 share_token 做嚴格相等比對後吐資料
alter table public.projects
  add column if not exists share_token text unique;

create index if not exists projects_share_token_idx on public.projects(share_token)
  where share_token is not null;

comment on column public.projects.share_token is
  '公開分享 token（nanoid）。產生後可用 /projects/[id]/quote?token=xxx 公開讀取。';
