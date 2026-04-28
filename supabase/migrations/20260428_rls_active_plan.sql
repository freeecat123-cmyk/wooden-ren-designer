-- =============================================================================
-- #9 RLS 補上訂閱檢查：免費 plan 不能存報價（quotes 系列功能）
-- =============================================================================
-- 之前只有前端 useUserPlan hook 擋付費功能，使用者改 JS 就能繞過呼叫 API。
-- 補一個 SQL function `auth_has_active_paid_plan()`，把訂閱檢查下沉到 RLS。
-- 之後新增「報價簽名連結 / 客戶管理」等付費資源時，policy 都用這個函式。
-- =============================================================================

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

  -- lifetime / pro / personal / student 視為付費；free 拒絕
  if user_plan = 'free' then
    return false;
  end if;

  -- lifetime 不檢查到期
  if user_plan = 'lifetime' then
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

-- ----- designs 表：保留現有 own-row policy，但限制每位 user 最多 N 筆（free 用） -----
-- 註：純權限檢查可在前端做；這裡示範 RLS 強化。實際限制邏輯（free=3 / personal=20 …）
-- 由前端 + Supabase API 共同檢查，這份 migration 不寫 hard cap，先擺骨架。

-- ----- 範例：以後加報價簽名表 quotes 時，policy 寫法 -----
-- create policy "quotes_paid_only" on public.quotes for all
--   using (auth_has_active_paid_plan() and auth.uid() = user_id)
--   with check (auth_has_active_paid_plan() and auth.uid() = user_id);
