-- =============================================================================
-- 上線前 critical security fixes
--
-- 修 5 大 audit 結論：
--   1. users 表 column-level UPDATE：user 不能自改 plan/subscription/student_*
--   2. Pro 資源 RLS 加 auth_has_active_paid_plan() 守門
--      （projects, project_items, project_messages, user_branding）
--   3. payments.ecpay_trade_no UNIQUE → webhook replay 被 DB 擋
--   4. subscriptions.ecpay_merchant_trade_no UNIQUE → 同 order 二次 insert 擋
--   5. designs INSERT 上限 (free 3 件 paid 無限) via auth_has_active_paid_plan + count subquery
--
-- 取消訂閱 / 已 cancelled 仍能用付費功能到 expires_at 不變、auth_has_active_paid_plan
-- 已涵蓋（return true 直到 expires_at < now）。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. users 表 column-level UPDATE 限制
-- -----------------------------------------------------------------------------
-- user 能改自己 name / email / 個人偏好等，但 plan/subscription/student 由 service
-- role 才能改（綠界 webhook、cron sweep、admin UI 都走 service_role 繞 RLS）。
-- supabase PostgREST 對 column-level grant 是這樣處理：先 REVOKE 全部、再 GRANT
-- 允許的欄位。
revoke update on public.users from authenticated;
-- 只授權「無害」欄位的 update：name（顯示名、user_metadata 補 sync 用）
grant update (name) on public.users to authenticated;
-- 其他欄位（plan, subscription_*, student_*, email, last_*_at, created_at）
-- 一律不能 by-user 改。service_role 不受 column grant 限制、admin 可繞。

-- -----------------------------------------------------------------------------
-- 2a. projects 加付費守門
-- -----------------------------------------------------------------------------
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects for insert
  with check (auth.uid() = user_id and auth_has_active_paid_plan());

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and auth_has_active_paid_plan());

-- select / delete 不卡（已存在的資料能讀、能刪）
-- delete 不擋避免 user 升降級後 stuck

-- -----------------------------------------------------------------------------
-- 2b. project_items
-- -----------------------------------------------------------------------------
drop policy if exists "project_items_insert_own" on public.project_items;
create policy "project_items_insert_own" on public.project_items for insert
  with check (
    exists (select 1 from public.projects
            where projects.id = project_items.project_id
              and projects.user_id = auth.uid())
    and auth_has_active_paid_plan()
  );

drop policy if exists "project_items_update_own" on public.project_items;
create policy "project_items_update_own" on public.project_items for update
  using (
    exists (select 1 from public.projects
            where projects.id = project_items.project_id
              and projects.user_id = auth.uid())
  )
  with check (auth_has_active_paid_plan());

-- -----------------------------------------------------------------------------
-- 2c. project_messages
-- -----------------------------------------------------------------------------
drop policy if exists "owner_insert_messages" on public.project_messages;
create policy "owner_insert_messages" on public.project_messages for insert
  with check (
    exists (select 1 from public.projects
            where projects.id = project_messages.project_id
              and projects.user_id = auth.uid())
    and auth_has_active_paid_plan()
  );

-- -----------------------------------------------------------------------------
-- 2d. user_branding 自訂報價單抬頭（pro 功能）
-- -----------------------------------------------------------------------------
drop policy if exists "user_branding_insert_own" on public.user_branding;
create policy "user_branding_insert_own" on public.user_branding for insert
  with check (auth.uid() = user_id and auth_has_active_paid_plan());

drop policy if exists "user_branding_update_own" on public.user_branding;
create policy "user_branding_update_own" on public.user_branding for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and auth_has_active_paid_plan());

-- -----------------------------------------------------------------------------
-- 3. payments.ecpay_trade_no UNIQUE (where not null)
-- -----------------------------------------------------------------------------
-- 同一 ECPay TradeNo 不能重複寫入；webhook replay 會被 DB 擋。
-- 用 partial unique index 因 trade_no 可能為 null（pending payments）。
create unique index if not exists payments_ecpay_trade_no_uniq
  on public.payments (ecpay_trade_no)
  where ecpay_trade_no is not null;

-- -----------------------------------------------------------------------------
-- 4. subscriptions.ecpay_merchant_trade_no UNIQUE
-- -----------------------------------------------------------------------------
-- 同一 MerchantTradeNo 不能對到兩個 subscription（避免 checkout placeholder 撞號）
create unique index if not exists subscriptions_ecpay_mtn_uniq
  on public.subscriptions (ecpay_merchant_trade_no)
  where ecpay_merchant_trade_no is not null;

-- -----------------------------------------------------------------------------
-- 5. designs INSERT 上限（free=3 件、paid 無限）
-- -----------------------------------------------------------------------------
-- 之前 INSERT 只擋 user_id 一致、free 可無限存。RLS 加 count(*)<3 OR paid。
drop policy if exists "designs_insert_own" on public.designs;
create policy "designs_insert_own" on public.designs for insert
  with check (
    auth.uid() = user_id
    and (
      auth_has_active_paid_plan()
      or (select count(*) from public.designs where user_id = auth.uid()) < 3
    )
  );

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------
comment on column public.users.plan is
  '訂閱方案。column-level RLS：authenticated 不能改、只能 service_role 改（webhook/cron/admin）';
