-- 2026-08-24：補上 email_queue 的 RLS。
--
-- ⛔ 這張表存的是 to_email / subject / text_body / html_body —— 所有寄給客戶的
--    信箱與信件全文。它在 public schema，Supabase 預設會把 public schema 的表
--    透過 PostgREST 對外開放，而 anon key 是**印在瀏覽器 bundle 裡的公開值**。
--    沒有 RLS = 任何人拿那把公開金鑰就讀得到整份客戶名單。
--
-- 現況：正式站實測是有擋的（anon 寫入回 42501 row-level security），
--       代表當初是在 Supabase 後台**手動**開的，從來沒寫進 migration。
--       → 只要哪天從 migrations 重建資料庫（新環境、災難復原、staging），
--         這張表就會變成全世界可讀，而且不會有任何錯誤訊息提醒。
--
-- 這支的作用是把「線上已經是這樣」寫回版本控制，讓兩邊對得起來。
-- `enable row level security` 對已經開啟的表重跑是安全的（無副作用）。
alter table public.email_queue enable row level security;

-- 不建任何 policy = 預設全部拒絕。
-- 這張表只有後端用 service_role 存取（service_role 本來就繞過 RLS），
-- 前端與一般登入者都不該碰得到。
comment on table public.email_queue is
  'Resend 寄送失敗的 transactional emails 保留區。admin 可從 status=failed 撈出來判斷是否 replay。'
  || ' RLS 開啟且刻意不建 policy：只允許 service_role 存取（含客戶信箱與信件全文）。';
