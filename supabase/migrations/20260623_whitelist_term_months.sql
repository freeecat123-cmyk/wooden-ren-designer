-- =============================================================================
-- 白名單可選開通年限（半年 / 1 年 / 2 年）
-- =============================================================================
-- 取代 20260611_whitelist_auto_pro_1year.sql 寫死的「1 年」：
-- whitelist 加 term_months 欄，每筆白名單自己決定開通幾個月；
-- handle_new_user trigger 改成讀該 email 的 term_months 算到期日。
--
-- 決策 2026-06-23：要把「舊木匠學院會員」用半年（6 個月）開通，
-- 跟一般白名單（預設 1 年 / 12 個月）區分。
-- 既有 row 自動補 12 → 不改變任何現有行為、不動現有已開通學員。
--
-- 在 Supabase Dashboard → SQL Editor 整段貼上跑一次即可。
-- 安全重跑：ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE 已涵蓋。
-- =============================================================================

alter table public.whitelist
  add column if not exists term_months int not null default 12;

-- =============================================================================
-- 重寫 handle_new_user：讀 whitelist.term_months → pro + N 個月到期日
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term int;
  v_hit boolean := false;
begin
  -- 比對 whitelist（大小寫不敏感），同時把該筆的年限抓出來
  select coalesce(term_months, 12) into v_term
  from public.whitelist
  where lower(email) = lower(new.email)
  limit 1;
  v_hit := found;

  insert into public.users (id, email, name, plan, subscription_status, subscription_expires_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    case when v_hit then 'pro' else 'free' end,
    case when v_hit then 'active' else 'inactive' end,
    case when v_hit then now() + (v_term || ' months')::interval else null end
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
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='whitelist' and column_name='term_months';
--   → 1 筆，default 12
--
--   insert into public.whitelist (email, source, note, term_months)
--     values ('test-half@example.com', 'woodenrenclass', '舊會員半年', 6);
--   -- 用 test-half@example.com 註冊後：
--   select plan, subscription_status, subscription_expires_at
--     from public.users where email='test-half@example.com';
--   -- → 'pro' / 'active' / 約半年後的日期
-- =============================================================================
