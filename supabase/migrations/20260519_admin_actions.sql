-- admin_actions = audit log,記錄 admin 的所有寫操作。
-- 第一個用途:trace 「user.plan 為什麼變了」(例:萱容被升 lifetime 沒人記得是誰改的)。
--
-- service_role only 寫入,RLS 預設禁所有人,admin UI 透過 service role API 查。

create table if not exists public.admin_actions (
  id            uuid primary key default gen_random_uuid(),
  -- 操作者 (admin email,從 auth.users 來,不外鍵以免 admin 帳號刪了 audit 跟著消失)
  actor_email   text not null,
  -- 動作分類:user_plan_change / whitelist_upgrade / refund_approve / refund_reject 等
  action        text not null,
  -- 目標 user (nullable,某些 action 不對應特定 user)
  target_user_id  uuid,
  target_email    text,
  -- 變更前/後 snapshot (free-form jsonb,各 action 自己決定塞什麼)
  before_state  jsonb,
  after_state   jsonb,
  -- 理由 (admin 填的)
  reason        text,
  -- 時間
  created_at    timestamptz not null default now()
);

-- 常用查詢:依 target_user 倒序看誰改過 / 依 action 篩
create index if not exists admin_actions_target_user_id_idx
  on public.admin_actions (target_user_id, created_at desc);
create index if not exists admin_actions_action_idx
  on public.admin_actions (action, created_at desc);
create index if not exists admin_actions_created_at_idx
  on public.admin_actions (created_at desc);

-- RLS:全擋。admin UI 透過 service_role API 查,end user 完全看不到。
alter table public.admin_actions enable row level security;
-- 不加任何 policy = nobody (除 service_role) 可讀寫
