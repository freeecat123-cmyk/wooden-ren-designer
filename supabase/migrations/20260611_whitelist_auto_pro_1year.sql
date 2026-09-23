-- =============================================================================
-- 白名單自動開通：改成「專業版 pro・1 年」（取代原本 student・2 年）
-- =============================================================================
-- 取代 20260427_whitelist_auto_student.sql 的 handle_new_user：
-- 註冊時若 email 在 whitelist 表，users.plan 自動設成 'pro'、
-- subscription_status='active'、subscription_expires_at = 註冊日 + 1 年。
-- （pro 的 effective plan 是看 subscription_expires_at，所以一定要補到期日）
--
-- 決策 2026-06-11：白名單一律給「1 年專業版」，含課程學員。
-- 只影響「以後新註冊」的白名單 email；已開通的現有學員不動。
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
  is_whitelisted boolean;
begin
  -- 比對 whitelist（大小寫不敏感）
  select exists (
    select 1 from public.whitelist
    where lower(email) = lower(new.email)
  ) into is_whitelisted;

  insert into public.users (id, email, name, plan, subscription_status, subscription_expires_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    case when is_whitelisted then 'pro' else 'free' end,
    case when is_whitelisted then 'active' else 'inactive' end,
    case when is_whitelisted then now() + interval '1 year' else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- trigger 重綁（保險）
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 跑完驗證：
--   insert into public.whitelist (email, source, note) values ('test-pro@example.com', 'manual', '測試');
--   -- 用 test-pro@example.com 註冊後：
--   select plan, subscription_status, subscription_expires_at
--     from public.users where email='test-pro@example.com';
--   -- → 'pro' / 'active' / 約一年後的日期
-- =============================================================================
