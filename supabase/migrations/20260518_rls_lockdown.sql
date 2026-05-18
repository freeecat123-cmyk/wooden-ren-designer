-- =============================================================================
-- RLS lockdown：確保 payments / subscriptions / whitelist 都有 RLS 開啟 +
-- authenticated 拿不到別人的資料。
--
-- 背景：repo 沒有 create table migration（這些 table 從 Dashboard 建），
-- RLS 狀態看 Dashboard 設定；audit 發現可能漂移：
-- - whitelist 沒 RLS 的話、登入 user 直接 select * 可拿到所有學員 email
-- - payments 沒 RLS 可拿到所有人付款金額/trade_no
-- - subscriptions 同樣可拿
--
-- 全部用 idempotent SQL（不會 break 既有 policy）。
-- service_role 永遠繞 RLS、不影響 admin/webhook/cron 流程。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. payments：只能讀自己的
-- -----------------------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE：authenticated 不能寫（只有 service_role 能寫）
-- 不建 policy = deny by default after enable rls。

comment on table public.payments is
  'RLS: authenticated 只能讀自己。INSERT/UPDATE 由 service_role webhook 寫。';

-- -----------------------------------------------------------------------------
-- 2. subscriptions：只能讀自己的
-- -----------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

comment on table public.subscriptions is
  'RLS: authenticated 只能讀自己。INSERT/UPDATE 由 service_role checkout/webhook 寫。';

-- -----------------------------------------------------------------------------
-- 3. whitelist：authenticated 完全擋（學員 email 是 PII，不該外洩）
-- -----------------------------------------------------------------------------
alter table public.whitelist enable row level security;

-- 不建任何 policy = authenticated 完全讀不到、寫不到。
-- admin 用 service_role 透過 /api/admin/whitelist 讀寫。

comment on table public.whitelist is
  'RLS: authenticated 完全擋（學員 email PII）。admin 走 service_role API。';

-- -----------------------------------------------------------------------------
-- 4. users update self policy：補 USING + WITH CHECK 確保只能改自己 row
-- -----------------------------------------------------------------------------
-- 前 migration 已 revoke update on public.users + grant update (name)
-- 但沒寫 USING/WITH CHECK policy，視 Dashboard 是否預設有 policy。
-- 這裡 idempotent 補：user 只能 UPDATE 自己 row。
drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- SELECT policy：authenticated 只能讀自己 row（含 plan/expires_at 等）
drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users
  for select using (auth.uid() = id);

comment on table public.users is
  'RLS: 讀寫只限自己 row。可寫欄位由 column-level GRANT (name) 限制。';
