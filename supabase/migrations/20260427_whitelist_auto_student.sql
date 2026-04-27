-- =============================================================================
-- 白名單自動開通 student 方案
-- =============================================================================
-- 取代 schema.sql 內原本的 handle_new_user：
-- 註冊時若 email 在 whitelist 表，users.plan 自動設成 'student'，
-- subscription_status 同步 'active'（學員方案不會過期）。
--
-- 在 Supabase Dashboard → SQL Editor 整段貼上跑一次即可。
-- 安全重跑：CREATE OR REPLACE 已涵蓋；trigger 重綁也已 drop 重建。
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_student boolean;
begin
  -- 比對 whitelist（大小寫不敏感）
  select exists (
    select 1 from public.whitelist
    where lower(email) = lower(new.email)
  ) into is_student;

  insert into public.users (id, email, name, plan, subscription_status)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    case when is_student then 'student' else 'free' end,
    case when is_student then 'active' else 'inactive' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- trigger 重綁（schema.sql 已建過時這行只是保險）
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 跑完驗證：
--   select tgname from pg_trigger where tgname = 'on_auth_user_created';
--   → 1 筆
--
-- 測試（在 SQL Editor 跑）：
--   insert into public.whitelist (email, source, note) values ('test@example.com', 'manual', '測試');
--   -- 接著用 test@example.com 註冊（OAuth 或 email），
--   -- 然後 select plan, subscription_status from public.users where email='test@example.com';
--   -- → 'student' / 'active'
-- =============================================================================
