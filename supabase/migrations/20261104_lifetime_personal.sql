-- =============================================================================
-- 限量終身買斷：新增 users.plan = 'lifetime_personal'（個人版功能、永久、不到期）
-- =============================================================================
-- 跟既有的 'lifetime'（專業版等級，英文站 Lemon Squeezy／後台手動升級）是兩個不同方案，
-- 既有 lifetime 會員完全不受影響。程式端見 lib/pricing/lifetime.ts、lib/permissions.ts。
--
-- ⚠️ 這支只寫檔，不會自動執行。要先在正式資料庫跑過，才能上線終身買斷：
--    綠界付款成功後會把 users.plan 寫成 'lifetime_personal'，約束沒放行會寫入失敗
--    （程式會留 _unlock_failed 記號並寄信通知管理員，但客人付了錢拿不到東西）。
--
-- 可重複執行（idempotent）。
-- =============================================================================

-- 1. users.plan 的 check 約束：先找出現有那條（名稱不一定叫 users_plan_check）再換掉
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.users'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ~ '^CHECK \(\(plan = ANY'
  loop
    execute format('alter table public.users drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.users
  add constraint users_plan_check
  check (plan in ('free', 'personal', 'pro', 'lifetime', 'lifetime_personal', 'student'));

-- 2. RLS 用的「是否為有效付費方案」：終身個人版跟 lifetime 一樣不檢查到期日
create or replace function public.auth_has_active_paid_plan()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  user_plan text;
  expires timestamptz;
begin
  select plan, subscription_expires_at into user_plan, expires
    from public.users
   where id = auth.uid();

  if user_plan is null then
    return false;
  end if;

  if user_plan = 'free' then
    return false;
  end if;

  -- lifetime / lifetime_personal 不檢查到期
  if user_plan in ('lifetime', 'lifetime_personal') then
    return true;
  end if;

  -- 其他需 expires_at > now()
  if expires is null or expires < now() then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.auth_has_active_paid_plan() to authenticated;
