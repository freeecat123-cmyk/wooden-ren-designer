-- =============================================================================
-- #7 學員到期漸進降級 + email 提醒記錄
-- =============================================================================
-- 之前學員到期是直接「失效」，使用者完全不知道。改成：
--   D-30：發第一封 email 提醒
--   D-7 ：發第二封 email 提醒（並從應用層開始隱藏進階功能 deeplink）
--   D 0 ：plan 自動降為 'free'（保留 student_expires_at 紀錄）
-- 寄信靠應用層 cron job（Vercel Cron / GitHub Actions）每日跑一次：
--   select * from students_due_for_reminder('30d');  -- 抓出該寄 30 天提醒的
--   select mark_student_reminder_sent(user_id, '30d');  -- 寄完更新狀態
-- =============================================================================

alter table public.users
  add column if not exists student_reminder_30d_sent_at timestamptz,
  add column if not exists student_reminder_7d_sent_at timestamptz,
  add column if not exists student_downgraded_at timestamptz;

-- 找出該寄第一封提醒的學員（到期 ≤ 30 天且還沒寄過 30d 提醒）
create or replace function public.students_due_for_30d_reminder()
returns table (
  user_id uuid,
  email text,
  name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, email, name, student_expires_at
    from public.users
   where plan = 'student'
     and student_expires_at is not null
     and student_expires_at <= now() + interval '30 days'
     and student_expires_at > now() + interval '7 days'
     and student_reminder_30d_sent_at is null;
$$;

-- 找出該寄第二封提醒的學員（到期 ≤ 7 天且還沒寄過 7d 提醒）
create or replace function public.students_due_for_7d_reminder()
returns table (
  user_id uuid,
  email text,
  name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, email, name, student_expires_at
    from public.users
   where plan = 'student'
     and student_expires_at is not null
     and student_expires_at <= now() + interval '7 days'
     and student_expires_at > now()
     and student_reminder_7d_sent_at is null;
$$;

-- 標記提醒已寄
create or replace function public.mark_student_reminder_sent(p_user_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = '30d' then
    update public.users set student_reminder_30d_sent_at = now() where id = p_user_id;
  elsif p_kind = '7d' then
    update public.users set student_reminder_7d_sent_at = now() where id = p_user_id;
  else
    raise exception 'unknown reminder kind: %', p_kind;
  end if;
end;
$$;

-- 批次降級已過期學員 → free。回傳被降級的 user_id 陣列。
create or replace function public.downgrade_expired_students()
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id from public.users
     where plan = 'student'
       and student_expires_at is not null
       and student_expires_at < now()
       and student_downgraded_at is null
  loop
    update public.users
       set plan = 'free',
           subscription_status = 'expired',
           student_downgraded_at = now()
     where id = r.id;
    return next r.id;
  end loop;
end;
$$;

-- 全部限制 service_role 才能呼叫（外部 cron / admin script 走 service_role key）
revoke all on function public.students_due_for_30d_reminder() from public, anon, authenticated;
revoke all on function public.students_due_for_7d_reminder() from public, anon, authenticated;
revoke all on function public.mark_student_reminder_sent(uuid, text) from public, anon, authenticated;
revoke all on function public.downgrade_expired_students() from public, anon, authenticated;

grant execute on function public.students_due_for_30d_reminder() to service_role;
grant execute on function public.students_due_for_7d_reminder() to service_role;
grant execute on function public.mark_student_reminder_sent(uuid, text) to service_role;
grant execute on function public.downgrade_expired_students() to service_role;

-- ======== 應用層 cron job 範本 ========
-- Vercel Cron 寫一支 /api/cron/student-reminders（service_role）：
--   1. 抓 students_due_for_30d_reminder() → 寄信 → mark_student_reminder_sent(uid, '30d')
--   2. 抓 students_due_for_7d_reminder()  → 寄信 → mark_student_reminder_sent(uid, '7d')
--   3. downgrade_expired_students() → 對降級者寄第三封 (已降級通知)
-- vercel.json:
--   { "crons": [{ "path": "/api/cron/student-reminders", "schedule": "0 9 * * *" }] }
