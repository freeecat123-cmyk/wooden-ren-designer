-- =============================================================================
-- Lemon Squeezy webhook 上線 hotfix
--
-- 兩類修正：
--
-- 1. partial unique index → full UNIQUE constraint
--    原 migration 20260527 建的是 `... where lemonsqueezy_xxx_id is not null` 的
--    partial unique index。PostgreSQL `INSERT ... ON CONFLICT (col)` 只能 match
--    full unique constraint（或無 WHERE 的 unique index），Supabase JS 的 upsert
--    沒辦法帶 WHERE，所以 webhook 跑 upsert 全噴：
--      "there is no unique or exclusion constraint matching the ON CONFLICT"
--    full UNIQUE 本來就允許多個 NULL，舊 ECPay 資料 lemonsqueezy_*=NULL 不衝突。
--
-- 2. subscriptions / payments 補 SELECT RLS policy
--    `template_unlocks` / `tool_unlocks` 已有 `auth.uid() = user_id` policy，
--    `subscriptions` / `payments` 兩張表 RLS enabled 但沒任何 SELECT policy，
--    導致前端 anon key 一律被擋 → /my-subscription 顯示「沒有有效的訂閱」即使
--    DB 有資料。webhook 走 service_role 不受影響，所以是讀取端 bug。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. subscriptions：partial unique index → full UNIQUE constraint
-- -----------------------------------------------------------------------------
drop index if exists public.subscriptions_lemonsqueezy_sub_id_uniq;
alter table public.subscriptions
  drop constraint if exists subscriptions_lemonsqueezy_sub_id_key;
alter table public.subscriptions
  add constraint subscriptions_lemonsqueezy_sub_id_key
  unique (lemonsqueezy_subscription_id);

-- -----------------------------------------------------------------------------
-- 2. payments：partial unique index → full UNIQUE constraint
-- -----------------------------------------------------------------------------
drop index if exists public.payments_lemonsqueezy_order_id_uniq;
alter table public.payments
  drop constraint if exists payments_lemonsqueezy_order_id_key;
alter table public.payments
  add constraint payments_lemonsqueezy_order_id_key
  unique (lemonsqueezy_order_id);

-- -----------------------------------------------------------------------------
-- 3. subscriptions：補 SELECT RLS policy
-- -----------------------------------------------------------------------------
drop policy if exists "user reads own subscriptions" on public.subscriptions;
create policy "user reads own subscriptions"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. payments：補 SELECT RLS policy
-- -----------------------------------------------------------------------------
drop policy if exists "user reads own payments" on public.payments;
create policy "user reads own payments"
  on public.payments
  for select
  using (auth.uid() = user_id);
