-- =============================================================================
-- 木頭仁工程圖生成器 SaaS schema
-- =============================================================================
-- 在 Supabase Dashboard → SQL Editor 整份貼上跑一次。
-- 這份 schema 跨 5 張表 + RLS 規則 + auth user 自動同步 trigger。
-- =============================================================================

-- 確保 uuid 生成函式可用（Supabase 預設已啟，這行只是保險）
create extension if not exists "pgcrypto";


-- =============================================================================
-- 1. users 表：跟 auth.users 連動的應用層會員資料
-- =============================================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  plan text not null default 'free'
    check (plan in ('free', 'personal', 'pro', 'lifetime', 'student')),
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'cancelled', 'expired')),
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);


-- =============================================================================
-- 2. designs 表：使用者存的家具設計
-- =============================================================================
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  furniture_type text not null,            -- 'side_table' / 'round_stool' / ...
  name text,                                -- 使用者自訂名稱（可空，UI 顯示時 fallback 到 furniture_type）
  params jsonb not null,                    -- 完整設計參數（寬高深、木材、apron/leg/...）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists designs_user_id_idx on public.designs (user_id);
create index if not exists designs_user_created_idx on public.designs (user_id, created_at desc);


-- =============================================================================
-- 3. subscriptions 表：訂閱訂單紀錄（一個 user 可能有多筆，例如續訂、升級）
-- =============================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null check (plan in ('personal', 'pro', 'lifetime')),
  status text not null check (status in ('active', 'cancelled', 'expired')),
  started_at timestamptz not null,
  expires_at timestamptz,                    -- lifetime 可空
  ecpay_merchant_trade_no text,              -- 綠界訂單編號
  ecpay_periodic_no text,                    -- 綠界定期定額編號
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);


-- =============================================================================
-- 4. payments 表：每次扣款紀錄（含失敗）
-- =============================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount integer not null,                  -- NT$ 整數
  status text not null check (status in ('success', 'failed', 'pending')),
  ecpay_trade_no text,                      -- 綠界交易編號
  ecpay_payment_date timestamptz,
  raw_response jsonb,                       -- 綠界完整回呼資料（除錯用）
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_subscription_id_idx on public.payments (subscription_id);


-- =============================================================================
-- 5. whitelist 表：學員白名單（Hahow / 木匠學院 學生免費或優惠）
-- =============================================================================
create table if not exists public.whitelist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,                               -- 'hahow' / 'woodenrenclass' / 'manual'
  note text,
  created_at timestamptz not null default now()
);

create index if not exists whitelist_email_idx on public.whitelist (email);


-- =============================================================================
-- updated_at 自動更新 trigger（users / designs 用）
-- =============================================================================
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
  before update on public.users
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at on public.designs;
create trigger set_updated_at
  before update on public.designs
  for each row execute function public.tg_set_updated_at();


-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
-- 預設先全開 RLS、再建 policy 開白名單。沒寫 policy 的存取一律拒絕。
-- =============================================================================

alter table public.users enable row level security;
alter table public.designs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.whitelist enable row level security;


-- ----- users 表：使用者只能讀寫自己的資料 -----
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 注意：INSERT 不開給一般使用者——靠 trigger 從 auth.users 自動建（service_role 走 SECURITY DEFINER）


-- ----- designs 表：使用者只能讀寫自己的設計 -----
drop policy if exists "designs_select_own" on public.designs;
create policy "designs_select_own"
  on public.designs for select
  using (auth.uid() = user_id);

drop policy if exists "designs_insert_own" on public.designs;
create policy "designs_insert_own"
  on public.designs for insert
  with check (auth.uid() = user_id);

drop policy if exists "designs_update_own" on public.designs;
create policy "designs_update_own"
  on public.designs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "designs_delete_own" on public.designs;
create policy "designs_delete_own"
  on public.designs for delete
  using (auth.uid() = user_id);


-- ----- subscriptions / payments / whitelist：一般使用者完全不能讀寫 -----
-- 不建 policy = 預設拒絕。只有 service_role key（後端 webhook / admin script）能操作。
-- 例外：使用者要在頁面看自己的訂閱 / 付款記錄時，再加「user 只能讀自己 user_id 的列」policy。
-- 目前先全鎖，付款流程做完再開放讀取。


-- =============================================================================
-- auth.users 新增時自動建 public.users 紀錄
-- =============================================================================
-- Google OAuth / Email 註冊時 Supabase Auth 會在 auth.users 插一筆，
-- 透過此 trigger 立即在 public.users 同步建立應用層紀錄。
-- 用 SECURITY DEFINER 讓 trigger 以 superuser 權限跑，繞過 RLS。
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  )
  on conflict (id) do nothing;   -- 二次 trigger 安全
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 完成檢查（在 Supabase Dashboard 跑：）
-- =============================================================================
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
-- → 5 張表都應該 rowsecurity = true
--
-- select tgname from pg_trigger where tgname = 'on_auth_user_created';
-- → 應該有 1 筆
--
-- select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename, policyname;
-- → users 2 條、designs 4 條
-- =============================================================================
