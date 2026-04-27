-- =============================================================================
-- 學員方案改成「2 年免費 + 第 3 年起續用價」
-- =============================================================================
-- 新增 users.student_activated_at / student_expires_at；
-- 為既有 student 補上資料（從 created_at 起算 2 年）；
-- handle_new_user trigger 改寫加上自動填到期日；
-- extend_all_students() function 給管理員批次延長到期日用。
--
-- Supabase Dashboard → SQL Editor 整段貼上跑一次。
-- 全部都用 IF NOT EXISTS / OR REPLACE，重跑安全。
-- =============================================================================

alter table public.users
  add column if not exists student_activated_at timestamptz,
  add column if not exists student_expires_at timestamptz;

-- 既有 student：從 created_at 起算 2 年（沒有 activated_at 才補）
update public.users
set
  student_activated_at = created_at,
  student_expires_at = created_at + interval '2 years'
where plan = 'student'
  and student_activated_at is null;


-- =============================================================================
-- 1. 改寫 handle_new_user：白名單 → student + 2 年到期日
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
  select exists (
    select 1 from public.whitelist
    where lower(email) = lower(new.email)
  ) into is_student;

  insert into public.users (
    id, email, name, plan, subscription_status,
    student_activated_at, student_expires_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    case when is_student then 'student' else 'free' end,
    case when is_student then 'active' else 'inactive' end,
    case when is_student then now() else null end,
    case when is_student then now() + interval '2 years' else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 2. 批次延長所有學員到期日（管理員工具用）
-- =============================================================================
create or replace function public.extend_all_students(days int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  update public.users
  set student_expires_at = coalesce(student_expires_at, now()) + (days || ' days')::interval
  where plan = 'student';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- 限制：只有 service_role 能呼叫（一般使用者透過 PostgREST 的 RPC 仍可能觸發）
revoke all on function public.extend_all_students(int) from public, anon, authenticated;
grant execute on function public.extend_all_students(int) to service_role;


-- =============================================================================
-- 驗證：
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='users'
--       and column_name in ('student_activated_at','student_expires_at');
--   → 2 筆
--
--   select email, plan, student_activated_at, student_expires_at
--     from public.users where plan='student';
--   → 都有日期了
--
--   select public.extend_all_students(0);   -- 0 天 = 不變，但驗證 function 存在
-- =============================================================================
